# Requirements Verification Questions

Please answer the following questions to clarify the requirements for the Parkly smart parking platform implementation.

---

## Question 1: Initial Implementation Phase
Based on the vision document, which phase should we implement first?

A) Phase 1 - MVP: Manual onboarding, one city, rule-based AI, basic marketplace

B) Phase 2 - Automation: Corporate parking, business dashboards, prediction engine, dynamic pricing

C) Phase 3 - Government partnerships: IoT, smart gates, enterprise APIs, analytics

D) Phase 4 - National expansion: AI optimization, cross-city booking, enterprise SaaS

X) Other (please describe after [Answer]: tag below)

[Answer]: 

---

## Question 2: Target City for MVP
Which city will be the initial target for the MVP deployment?

A) Bangalore

B) Mumbai

C) Delhi

D) Chennai

E) Hyderabad

X) Other (please describe after [Answer]: tag below)

[Answer]: 

---

## Question 3: Primary User Interfaces to Implement
Which user interfaces should be prioritized for the MVP?

A) Driver Mobile App only

B) Driver Mobile App + Host Dashboard

C) Driver Mobile App + Host Dashboard + Admin Portal

D) All interfaces (Driver App, Host Dashboard, Admin Portal, Government Dashboard)

X) Other (please describe after [Answer]: tag below)

[Answer]: 

---

## Question 4: Mobile Platform Priority
For the Driver Mobile App, which platform(s) should we target first?

A) Android only

B) iOS only

C) Both Android and iOS (native)

D) React Native (cross-platform)

E) Flutter (cross-platform)

X) Other (please describe after [Answer]: tag below)

[Answer]: 

---

## Question 5: AI/ML Implementation Approach
What level of AI sophistication should the MVP include?

A) No AI - static parking list and manual search only

B) Rule-based recommendations only (if-then logic based on distance, price, availability)

C) Rule-based recommendations + Basic ML prediction (using historical data patterns)

D) Full AI stack with Amazon Bedrock + SageMaker for recommendations and predictions

X) Other (please describe after [Answer]: tag below)

[Answer]: 

---

## Question 6: Payment Integration
Which payment methods should be integrated in the MVP?

A) UPI only (simplest for India market)

B) UPI + Credit/Debit Cards

C) UPI + Cards + Digital Wallets

D) All payment methods including Net Banking and Corporate Billing

X) Other (please describe after [Answer]: tag below)

[Answer]: 

---

## Question 7: AWS Service Priority
Based on the AWS Tools document, which services are MUST-HAVE for MVP?

A) Core only: API Gateway, Lambda, DynamoDB, RDS, S3, Cognito/IAM

B) Core + Intelligence: Above + Bedrock for chatbot/assistance

C) Core + Analytics: Core services + EventBridge, Glue, Athena, QuickSight

D) Full stack: All AWS services mentioned in the AWS Tools document

X) Other (please describe after [Answer]: tag below)

[Answer]: 

---

## Question 8: Host Verification Process
For the MVP, how should parking space hosts be verified?

A) Self-service with automated verification (upload documents, automatic approval)

B) Manual verification by admin (upload documents, admin reviews and approves)

C) Hybrid (automatic for simple cases, manual review for complex cases)

D) No verification in MVP (accept all listings, add verification later)

X) Other (please describe after [Answer]: tag below)

[Answer]: 

---

## Question 9: Real-time Occupancy Tracking
Should the MVP include real-time parking occupancy tracking?

A) No real-time tracking - rely on booking calendar only

B) Manual updates - hosts manually update availability

C) Semi-automated - send notification to host when booking starts/ends, host confirms

D) Fully automated - integrate with IoT sensors or cameras (requires hardware)

X) Other (please describe after [Answer]: tag below)

[Answer]: 

---

## Question 10: Navigation Integration
Which navigation service should be integrated?

A) Google Maps API

B) Apple Maps

C) Mapbox

D) Multiple options - let user choose their preferred navigation app

X) Other (please describe after [Answer]: tag below)

[Answer]: 

---

## Question 11: Dynamic Pricing
Should dynamic pricing be included in the MVP?

A) No - hosts set fixed prices only

B) Yes - simple demand-based multiplier (peak hours, weekends)

C) Yes - advanced ML-based pricing using SageMaker

D) Suggested pricing - AI suggests prices but hosts have final control

X) Other (please describe after [Answer]: tag below)

[Answer]: 

---

## Question 12: User Authentication
What authentication mechanism should be used?

A) Email/Password only

B) Phone number + OTP (SMS-based)

C) Social login (Google, Facebook)

D) Multiple options (Email, Phone, Social login)

X) Other (please describe after [Answer]: tag below)

[Answer]: 

---

## Question 13: Search Functionality
What search capabilities should be implemented in the MVP?

A) Basic - search by location/address only

B) Intermediate - search by location + filters (price, distance, vehicle type)

C) Advanced - search by location + filters + availability prediction

D) Full - Natural language search using Bedrock ("Find parking near T Nagar under ₹50")

X) Other (please describe after [Answer]: tag below)

[Answer]: 

---

## Question 14: Booking Flexibility
What booking options should be available?

A) Instant booking only (book available slots immediately)

B) Instant + Scheduled booking (book for future dates/times)

C) Instant + Scheduled + Recurring booking (daily, weekly)

D) All booking types including event-based and corporate bookings

X) Other (please describe after [Answer]: tag below)

[Answer]: 

---

## Question 15: Notification System
Which notification channels should be implemented?

A) In-app notifications only

B) In-app + Push notifications

C) In-app + Push + SMS

D) In-app + Push + SMS + Email

X) Other (please describe after [Answer]: tag below)

[Answer]: 

---

## Question 16: Reviews and Ratings
Should the MVP include review and rating functionality?

A) No reviews in MVP

B) Yes - ratings only (1-5 stars)

C) Yes - ratings + written reviews

D) Yes - ratings + reviews + photo uploads

X) Other (please describe after [Answer]: tag below)

[Answer]: 

---

## Question 17: Admin Dashboard Features
What capabilities should the Admin Dashboard have in MVP?

A) Basic monitoring - view users, bookings, transactions

B) Intermediate - monitoring + manual fraud detection + dispute resolution

C) Advanced - monitoring + automated fraud alerts + analytics + user management

D) Full - all features including city management, business analytics, government reporting

X) Other (please describe after [Answer]: tag below)

[Answer]: 

---

## Question 18: Infrastructure Deployment
How should the infrastructure be deployed?

A) Manual deployment - deploy services individually using AWS console

B) Infrastructure as Code - use AWS CDK or CloudFormation

C) CI/CD pipeline - automated deployment with GitHub Actions or AWS CodePipeline

D) Full DevOps - IaC + CI/CD + automated testing + monitoring

X) Other (please describe after [Answer]: tag below)

[Answer]: 

---

## Question 19: Testing Strategy
What testing approach should be followed?

A) Manual testing only

B) Unit tests for critical business logic

C) Unit tests + Integration tests

D) Comprehensive - Unit + Integration + E2E + Load testing

X) Other (please describe after [Answer]: tag below)

[Answer]: 

---

## Question 20: Data Privacy and Compliance
What compliance requirements should be addressed in MVP?

A) Basic - secure storage and transmission only

B) Intermediate - Basic security + data encryption + audit logs

C) Advanced - GDPR-ready, data anonymization, user data deletion

D) Full compliance - GDPR + PCI-DSS (for payments) + local regulations

X) Other (please describe after [Answer]: tag below)

[Answer]: 

---

## Question: Security Extensions
Should security extension rules be enforced for this project?

A) Yes — enforce all SECURITY rules as blocking constraints (recommended for production-grade applications)

B) No — skip all SECURITY rules (suitable for PoCs, prototypes, and experimental projects)

X) Other (please describe after [Answer]: tag below)

[Answer]: 

---

## Question: Resiliency Extensions
Should the resiliency baseline be applied to this project?

**What this extension is.** Enabling it applies a set of **directional, design-time best practices** for building resilient systems, derived from the **AWS Well-Architected Framework (Reliability Pillar)** and resilience-review guidance. It steers requirements, design, and code toward fault tolerance, high availability, observability, and recoverability — covering 15 practice areas across business goals, change management, observability, high availability, disaster recovery, and continuous improvement.

**What this extension is NOT.** Enabling it does **not** make your workload production-ready, nor does it certify or guarantee any availability, RTO, or RPO target. It is a **starting point** that scaffolds good resiliency decisions early — it is not a substitute for a formal **AWS Well-Architected Review** of the built system.

Treat the output as a well-grounded **first draft of your resiliency posture** to build on and validate — not a finished, production-certified result.

A) Yes — apply the resiliency baseline as directional best practices and design-time guidance (recommended for business-critical workloads, as an informed starting point that you can validate and harden before go-live)

B) No — skip the resiliency baseline (suitable for PoCs, prototypes, and experimental projects where rapid iteration matters more than reliability)

X) Other (please describe after [Answer]: tag below)

[Answer]: 

---

## Question: Property-Based Testing Extension
Should property-based testing (PBT) rules be enforced for this project?

A) Yes — enforce all PBT rules as blocking constraints (recommended for projects with business logic, data transformations, serialization, or stateful components)

B) Partial — enforce PBT rules only for pure functions and serialization round-trips (suitable for projects with limited algorithmic complexity)

C) No — skip all PBT rules (suitable for simple CRUD applications, UI-only projects, or thin integration layers with no significant business logic)

X) Other (please describe after [Answer]: tag below)

[Answer]: 

---

**Instructions:**
1. Please answer each question by entering the letter choice (A, B, C, D, E, or X) after the [Answer]: tag
2. If you choose "X) Other", please provide your specific requirements after the [Answer]: tag
3. Let me know when you have completed all questions so I can proceed with the requirements analysis
