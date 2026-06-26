// ============================================================
// Notification Service — Multi-channel Notifications
// Consumes EventBridge events: BookingCreated, PaymentCompleted, etc.
// Channels: In-App (DynamoDB), Push (FCM), SMS (SNS).
// ============================================================

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Router, Request, Response, NextFunction } from 'express';
import { PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { PublishCommand } from '@aws-sdk/client-sns';
import { initializeApp, cert, App } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';


import {
  authenticate,
  errorHandler,
  notFoundHandler,
  requestLogger,
  responseTimer,
  securityHeaders,
  logger,
  getConfig,
  getDocClient,
  getSNSClient,
  generateId,
  ApiResponse,
  Notification,
  NotificationType,
  NotificationChannel,
} from '@parkly/shared';

const PORT = process.env['NOTIFICATION_PORT'] || 4009;
const SERVICE_NAME = 'notification-service';
process.env['SERVICE_NAME'] = SERVICE_NAME;

// ============================================================
// FCM Initialisation (lazy — only if configured)
// ============================================================

let firebaseApp: App | null = null;

function getFirebaseApp(): App | null {

  if (firebaseApp) return firebaseApp;

  const config = getConfig();
  if (
    config.pushProvider !== 'fcm' ||
    !config.fcmProjectId ||
    !config.fcmClientEmail ||
    !config.fcmPrivateKey ||
    config.fcmPrivateKey === 'replace-with-fcm-private-key'
  ) {
    return null;
  }

  try {
    firebaseApp = initializeApp({
      credential: cert({
        projectId: config.fcmProjectId,
        clientEmail: config.fcmClientEmail,
        privateKey: config.fcmPrivateKey!.replace(/\\n/g, '\n'),
      }),
    });
    logger.info({ projectId: config.fcmProjectId }, 'Firebase Admin SDK initialized');
  } catch (err) {
    logger.error({ err }, 'Failed to initialize Firebase Admin SDK');
  }

  return firebaseApp;
}

// ============================================================
// FCM Push Sender
// ============================================================

async function sendFcmPush(params: {
  fcmToken: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}): Promise<void> {
  const app = getFirebaseApp();
  if (!app) {
    logger.info('[MOCK] FCM push skipped — Firebase not configured');
    return;
  }

  await getMessaging(app).send({
    token: params.fcmToken,
    notification: { title: params.title, body: params.body },
    data: params.data || {},
    android: {
      priority: 'high',
      notification: { sound: 'default', channelId: 'parkly_default' },
    },
    apns: {
      payload: { aps: { sound: 'default', badge: 1 } },
    },
  });
}

// ============================================================
// Notification Service Logic
// ============================================================

const notificationService = {
  async send(params: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    data?: Record<string, unknown>;
    channels: NotificationChannel[];
    phone?: string;
    fcmToken?: string;
  }): Promise<Notification> {
    const config = getConfig();
    const id = generateId();
    const now = new Date().toISOString();

    const notification: Notification = {
      id,
      userId: params.userId,
      type: params.type,
      title: params.title,
      body: params.body,
      data: params.data,
      channels: params.channels,
      read: false,
      createdAt: now,
    };

    // 1. In-App: store in DynamoDB
    if (params.channels.includes('in_app')) {
      await getDocClient().send(
        new PutCommand({
          TableName: config.dynamoTableNotifications,
          Item: { ...notification, pk: params.userId, sk: `NOTIF#${now}#${id}` },
        }),
      ).catch(err => logger.error({ err }, 'Failed to store in-app notification'));
    }

    // 2. SMS: via AWS SNS
    if (params.channels.includes('sms') && params.phone) {
      if (config.smsProvider === 'mock') {
        logger.info({ phone: params.phone.slice(0, 5) + '***', body: params.body }, '[MOCK] SMS notification');
      } else {
        await getSNSClient().send(
          new PublishCommand({
            PhoneNumber: params.phone,
            Message: `${params.title}: ${params.body}`,
            MessageAttributes: {
              'AWS.SNS.SMS.SenderID': { DataType: 'String', StringValue: config.snsSmsSenderId },
              'AWS.SNS.SMS.SMSType': { DataType: 'String', StringValue: 'Transactional' },
            },
          }),
        ).catch(err => logger.error({ err }, 'Failed to send SMS'));
      }
    }

    // 3. Push: FCM (real) or mock
    if (params.channels.includes('push')) {
      if (params.fcmToken) {
        try {
          await sendFcmPush({
            fcmToken: params.fcmToken,
            title: params.title,
            body: params.body,
            data: params.data ? Object.fromEntries(
              Object.entries(params.data).map(([k, v]) => [k, String(v)])
            ) : {},
          });
          logger.info({ userId: params.userId, type: params.type }, 'FCM push sent');
        } catch (err) {
          logger.error({ err, userId: params.userId }, 'FCM push failed');
        }
      } else {
        logger.info({ userId: params.userId, type: params.type }, '[MOCK] Push — no FCM token stored');
      }
    }

    notification.sentAt = now;
    return notification;
  },

  async getNotifications(userId: string): Promise<Notification[]> {
    const config = getConfig();
    const result = await getDocClient().send(
      new QueryCommand({
        TableName: config.dynamoTableNotifications,
        KeyConditionExpression: 'pk = :uid AND begins_with(sk, :prefix)',
        ExpressionAttributeValues: { ':uid': userId, ':prefix': 'NOTIF#' },
        ScanIndexForward: false,
        Limit: 50,
      }),
    );
    return (result.Items || []) as Notification[];
  },

  async markRead(userId: string, notificationId: string): Promise<void> {
    const config = getConfig();
    // Query for the notification to find its sort key
    const result = await getDocClient().send(
      new QueryCommand({
        TableName: config.dynamoTableNotifications,
        KeyConditionExpression: 'pk = :uid AND begins_with(sk, :prefix)',
        FilterExpression: 'id = :nid',
        ExpressionAttributeValues: { ':uid': userId, ':prefix': 'NOTIF#', ':nid': notificationId },
        Limit: 1,
      }),
    );

    const item = result.Items?.[0];
    if (item) {
      await getDocClient().send(
        new UpdateCommand({
          TableName: config.dynamoTableNotifications,
          Key: { pk: userId, sk: item['sk'] },
          UpdateExpression: 'SET #r = :val, readAt = :now',
          ExpressionAttributeNames: { '#r': 'read' },
          ExpressionAttributeValues: { ':val': true, ':now': new Date().toISOString() },
        }),
      );
    }

    logger.info({ userId, notificationId }, 'Notification marked as read');
  },
};

// ============================================================
// Routes
// ============================================================

const notificationRouter = Router();
notificationRouter.use(authenticate);

// GET /notifications — list user notifications
notificationRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const notifications = await notificationService.getNotifications(req.user!.sub);
    res.json({ success: true, data: notifications } as ApiResponse);
  } catch (err) {
    next(err);
  }
});

// PUT /notifications/:id/read
notificationRouter.put('/:id/read', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await notificationService.markRead(req.user!.sub, req.params['id']!);
    res.json({ success: true, data: { message: 'Marked as read' } } as ApiResponse);
  } catch (err) {
    next(err);
  }
});

// POST /notifications/send — internal endpoint (auth service, booking service etc.)
notificationRouter.post('/send', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const notification = await notificationService.send(req.body);
    res.status(201).json({ success: true, data: notification } as ApiResponse);
  } catch (err) {
    next(err);
  }
});

// ============================================================
// App
// ============================================================

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(securityHeaders);
app.use(responseTimer);
app.use(cors({ origin: process.env['ALLOWED_ORIGINS']?.split(',') || '*' }));
app.use(express.json({ limit: '1mb' }));
app.use(requestLogger);

app.get('/health', (_req, res) => {
  const fcmReady = getFirebaseApp() !== null;
  res.json({
    status: 'ok',
    service: SERVICE_NAME,
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    fcm: fcmReady ? 'connected' : 'mock',
    sms: getConfig().smsProvider,
  });
});
app.use('/notifications', notificationRouter);
app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(PORT, () => {
  logger.info({ port: PORT, service: SERVICE_NAME }, `${SERVICE_NAME} started`);
  const fcmReady = getFirebaseApp() !== null;
  logger.info({ fcm: fcmReady ? 'connected' : 'mock', sms: getConfig().smsProvider }, 'Notification channels ready');
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});

export default app;
