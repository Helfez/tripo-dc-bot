#!/bin/sh

# Push any new schema changes (e.g. TestCase/TestTask/TestResult tables)
npx prisma db push --skip-generate

# Start test platform in background
yarn test-platform &

# Start main bot (foreground)
exec yarn start
