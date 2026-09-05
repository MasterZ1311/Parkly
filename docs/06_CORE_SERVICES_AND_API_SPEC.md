# 🅿️ Parkly — Core Services & Detailed API Specifications

> **Document Version**: 1.0.0  
> **Protocol**: REST over HTTPS / JSON  
> **Base URL Format**: `https://api.parkly.in/api/v1` (or `http://localhost:4000/api/v1` for local dev)

---

## 1. Universal Request & Response Protocol

### 1.1 Headers
* `Content-Type: application/json`
* `Authorization: Bearer <JWT_ACCESS_TOKEN>` (for protected endpoints)
* `x-correlation-id: <UUID>` (auto-generated or forwarded for distributed tracing)

### 1.2 Standard Success Response Format
```json
{
  "success": true,
  "data": {},
  "meta": {
    "timestamp": "2026-09-05T09:30:00.000Z",
    "correlationId": "d3b07384-d113-4603-bbab-42790930777e"
  }
}
```

### 1.3 Standard Error Response Format
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Invalid phone number format. Must follow E.164 standard.",
    "details": [
      {
        "field": "phone",
        "issue": "String does not match pattern ^\\+[1-9]\\d{1,14}$"
      }
    ]
  },
  "meta": {
    "timestamp": "2026-09-05T09:30:00.000Z",
    "correlationId": "d3b07384-d113-4603-bbab-42790930777e"
  }
}
```

---

## 2. Service-by-Service API Specifications

### 2.1 Authentication Service (`auth-service` / `:4001`)

#### `POST /api/v1/auth/otp/request`
* **Description**: Initiates phone authentication by generating a 6-digit OTP and sending it via SMS.
* **Access**: Public
* **Request Body**:
  ```json
  {
    "phone": "+919876543210"
  }
  ```
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "message": "OTP sent successfully",
      "expiresInSeconds": 300
    }
  }
  ```

#### `POST /api/v1/auth/otp/verify`
* **Description**: Verifies the SMS OTP, creates user if first-time, and issues JWT access/refresh token pair.
* **Access**: Public
* **Request Body**:
  ```json
  {
    "phone": "+919876543210",
    "otp": "123456"
  }
  ```
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "accessToken": "eyJhbGciOi...",
      "refreshToken": "eyJhbGciOi...",
      "user": {
        "id": "usr_9921e1a8",
        "phone": "+919876543210",
        "name": "Arun Kumar",
        "role": "driver"
      }
    }
  }
  ```

---

### 2.2 Geospatial Search Service (`search-service` / `:4004`)

#### `POST /api/v1/search`
* **Description**: Finds nearby parking spaces within a given radius, enriched with live occupancy and AI predicted availability.
* **Access**: Public / Authenticated
* **Request Body**:
  ```json
  {
    "latitude": 13.0418,
    "longitude": 80.2341,
    "radiusMeters": 3000,
    "vehicleType": "sedan",
    "startTime": "2026-09-05T14:00:00Z",
    "durationMinutes": 120,
    "filters": {
      "evCharging": false,
      "covered": true,
      "maxPricePerHour": 60
    }
  }
  ```
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "results": [
        {
          "id": "spc_chennai_tnagar_01",
          "name": "T-Nagar Commercial Hub Parking",
          "address": "45 Usman Road, T. Nagar, Chennai",
          "latitude": 13.0425,
          "longitude": 80.235,
          "distanceMeters": 210,
          "hourlyRate": 40.00,
          "calculatedPrice": 80.00,
          "evCharging": false,
          "covered": true,
          "liveOccupancy": {
            "occupied": 8,
            "total": 12,
            "percentage": 66.7
          },
          "prediction": {
            "arrivalProbability": 84,
            "confidenceScore": 0.92,
            "estimatedVacancies": 4
          },
          "recommendationScore": 0.89
        }
      ]
    }
  }
  ```

---

### 2.3 Booking Service (`booking-service` / `:4002`)

#### `POST /api/v1/bookings`
* **Description**: Reserves a parking slot with atomic concurrency validation.
* **Access**: Driver / Authenticated
* **Request Body**:
  ```json
  {
    "spaceId": "spc_chennai_tnagar_01",
    "vehicleId": "veh_3811f92a",
    "type": "instant",
    "startTime": "2026-09-05T14:00:00Z",
    "durationMinutes": 120
  }
  ```
* **Response (201 Created)**:
  ```json
  {
    "success": true,
    "data": {
      "bookingId": "bkg_7718aa09",
      "status": "created",
      "totalAmount": 80.00,
      "currency": "INR",
      "holdExpiresAt": "2026-09-05T14:10:00Z",
      "paymentIntentToken": "pi_token_99182319"
    }
  }
  ```

---

### 2.4 Payment & Payout Service (`payment-service` / `:4003`)

#### `POST /api/v1/payments/initiate`
* **Description**: Prepares a secure UPI intent / Razorpay order for an active provisional booking.
* **Access**: Driver / Authenticated
* **Request Body**:
  ```json
  {
    "bookingId": "bkg_7718aa09",
    "provider": "razorpay"
  }
  ```
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "orderId": "order_Kz821h9Aa1",
      "amount": 8000,
      "currency": "INR",
      "upiIntentUrl": "upi://pay?pa=parkly@icici&pn=Parkly&am=80.00&tr=bkg_7718aa09"
    }
  }
  ```

#### `POST /api/v1/payments/webhook`
* **Description**: Webhook listener receiving asynchronous payment fulfillment notifications from payment gateways.
* **Access**: Gateway Signed / HMAC verified

---

### 2.5 Real-Time Occupancy & IoT Service (`occupancy-service` / `:4007`)

#### `POST /api/v1/occupancy/ingest`
* **Description**: Ingests sensor telematics, barrier gate ANPR readings, or mobile QR check-ins.
* **Access**: Authenticated Sensor / Gate Agent
* **Request Body**:
  ```json
  {
    "spaceId": "spc_chennai_tnagar_01",
    "occupiedSlots": 9,
    "totalSlots": 12,
    "source": "sensor",
    "timestamp": "2026-09-05T14:05:00Z"
  }
  ```
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "recorded": true,
      "occupancyPercentage": 75.0
    }
  }
  ```

---

### 2.6 Dynamic Pricing Service (`pricing-service` / `:4008`)

#### `POST /api/v1/pricing/quote`
* **Description**: Pure pricing engine calculating dynamic surge rates based on demand heuristics.
* **Formula**: `finalPrice = baseRate × demandMultiplier(hour, day, liveOccupancy)`
* **Invariants**: `finalPrice >= baseRate` (tested via property-based testing).

---

### 2.7 AI Availability Prediction Service (`prediction-service` / `:4005`)

#### `GET /api/v1/prediction/:spaceId?targetTime=2026-09-05T15:00:00Z&durationMinutes=120`
* **Description**: Returns estimated probability of vacancy, duration penalty, and confidence score.
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "spaceId": "spc_chennai_tnagar_01",
      "targetTime": "2026-09-05T15:00:00Z",
      "probability": 82.5,
      "confidence": 0.88,
      "estimatedVacancies": 3,
      "factors": {
        "dayOfWeek": "Saturday",
        "timeWindow": "afternoon_peak",
        "historicalOccupancyRate": 0.71
      }
    }
  }
  ```

---

### 2.8 Host Management Service (`host-service` / `:4010`)

#### `POST /api/v1/host/spaces`
* **Description**: Host registers a new parking space listing. Submits details, geolocation, photos, and base hourly rate for admin review.
* **Access**: Host Role

#### `GET /api/v1/host/earnings`
* **Description**: Returns host gross revenue, net payouts received, and upcoming pending settlements.
* **Access**: Host Role

---

### 2.9 Admin Governance & Platform Operations (`admin-service` / `:4011`)

#### `GET /api/v1/admin/verifications`
* **Description**: Lists pending host KYC documents and property deeds awaiting human verification.
* **Access**: Admin Role

#### `POST /api/v1/admin/verifications/:hostId/approve`
* **Description**: Approves host credentials and activates their listed parking spaces on the public search index.
* **Access**: Admin Role
