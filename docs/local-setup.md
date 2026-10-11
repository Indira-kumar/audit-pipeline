# Local setup

Run these steps from the repository root. You need Node.js 24 or newer and Docker.

## 1. Install and configure

```bash
npm ci
cp .env.example .env
```

## 2. Start MongoDB and seed examples

```bash
npm run db:up
npm run seed
```

The seed command is safe to run again; it keeps existing entries and edits.

## 3. Run the app

```bash
npm run dev
```

Open `http://127.0.0.1:5173`. Try creating evidence, editing a note, changing an amount, and finding similar cases on a completed seed record. New records stay `PENDING` until the AI worker is implemented.

Press `Ctrl+C` to stop the app. Run `npm run db:down` when you want to stop MongoDB.

## Check the code

```bash
npm run typecheck
npm run test
npm run build
```
