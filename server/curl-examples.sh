#!/usr/bin/env bash
# ==============================================================================
# Habit Tracker API - curl Examples & Verification Script
# ==============================================================================
# Demonstrates authentication, habits CRUD, completions, and dashboard stats.
# Prerequisite: Server running on http://localhost:5000

set -e

BASE_URL="http://localhost:5000/api"
COOKIE_JAR="/tmp/habit_tracker_cookies.txt"

echo "=== 1. Health Check ==="
curl -s -X GET "${BASE_URL}/health" | jq .
echo -e "\n"

echo "=== 2. User Signup ==="
SIGNUP_RES=$(curl -s -c "${COOKIE_JAR}" -X POST "${BASE_URL}/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.curl@example.com",
    "password": "Password123"
  }')
echo "${SIGNUP_RES}" | jq .
ACCESS_TOKEN=$(echo "${SIGNUP_RES}" | jq -r '.accessToken')
echo "Extracted Access Token: ${ACCESS_TOKEN:0:20}..."
echo -e "\n"

echo "=== 3. Get Authenticated User (/auth/me) ==="
curl -s -X GET "${BASE_URL}/auth/me" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" | jq .
echo -e "\n"

echo "=== 4. Create Habit (POST /habits) ==="
HABIT_RES=$(curl -s -X POST "${BASE_URL}/habits" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -d '{
    "name": "Morning Yoga",
    "description": "20 minutes daily morning stretching",
    "startDate": "2026-10-01",
    "frequency": "DAILY",
    "category": "Health",
    "reminderTime": "07:30"
  }')
echo "${HABIT_RES}" | jq .
HABIT_ID=$(echo "${HABIT_RES}" | jq -r '.habit._id')
echo "Created Habit ID: ${HABIT_ID}"
echo -e "\n"

echo "=== 5. List Active Habits (GET /habits) ==="
curl -s -X GET "${BASE_URL}/habits?status=active" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" | jq .
echo -e "\n"

echo "=== 6. Get Single Habit (GET /habits/:id) ==="
curl -s -X GET "${BASE_URL}/habits/${HABIT_ID}" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" | jq .
echo -e "\n"

echo "=== 7. Partial Update Habit (PATCH /habits/:id) ==="
curl -s -X PATCH "${BASE_URL}/habits/${HABIT_ID}" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -d '{
    "name": "Morning Vinyasa Yoga",
    "description": "30 minutes flow yoga"
  }' | jq .
echo -e "\n"

echo "=== 8. Upsert Completion (PUT /habits/:id/completions/:date) ==="
curl -s -X PUT "${BASE_URL}/habits/${HABIT_ID}/completions/2026-10-10" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" | jq .
echo -e "\n"

echo "=== 9. Idempotent Upsert (PUT again on same date - returns 200) ==="
curl -s -X PUT "${BASE_URL}/habits/${HABIT_ID}/completions/2026-10-10" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" | jq .
echo -e "\n"

echo "=== 10. Add Additional Completion ==="
curl -s -X PUT "${BASE_URL}/habits/${HABIT_ID}/completions/2026-10-15" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" | jq .
echo -e "\n"

echo "=== 11. List Completions with Date Range (GET /habits/:id/completions) ==="
curl -s -X GET "${BASE_URL}/habits/${HABIT_ID}/completions?from=2026-10-01&to=2026-10-31" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" | jq .
echo -e "\n"

echo "=== 12. Dashboard Stats (GET /dashboard/stats) ==="
curl -s -X GET "${BASE_URL}/dashboard/stats?from=2026-10-01&to=2026-10-29" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" | jq .
echo -e "\n"

echo "=== 13. Archive Habit (POST /habits/:id/archive) ==="
curl -s -X POST "${BASE_URL}/habits/${HABIT_ID}/archive" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" | jq .
echo -e "\n"

echo "=== 14. List Archived Habits (GET /habits?status=archived) ==="
curl -s -X GET "${BASE_URL}/habits?status=archived" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" | jq .
echo -e "\n"

echo "=== 15. Attempting to add completion to archived habit (Expected: 409 HABIT_ARCHIVED) ==="
curl -s -X PUT "${BASE_URL}/habits/${HABIT_ID}/completions/2026-10-20" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" | jq .
echo -e "\n"

echo "=== 16. Unarchive Habit (POST /habits/:id/unarchive) ==="
curl -s -X POST "${BASE_URL}/habits/${HABIT_ID}/unarchive" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" | jq .
echo -e "\n"

echo "=== 17. Undo Completion (DELETE /habits/:id/completions/:date) ==="
curl -s -i -X DELETE "${BASE_URL}/habits/${HABIT_ID}/completions/2026-10-15" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}"
echo -e "\n"

echo "=== 18. Rotate Refresh Token (POST /auth/refresh using httpOnly cookie) ==="
REFRESH_RES=$(curl -s -b "${COOKIE_JAR}" -c "${COOKIE_JAR}" -X POST "${BASE_URL}/auth/refresh")
echo "${REFRESH_RES}" | jq .
NEW_ACCESS_TOKEN=$(echo "${REFRESH_RES}" | jq -r '.accessToken')
echo "New Access Token: ${NEW_ACCESS_TOKEN:0:20}..."
echo -e "\n"

echo "=== 19. Hard Delete Habit (DELETE /habits/:id) ==="
curl -s -i -X DELETE "${BASE_URL}/habits/${HABIT_ID}" \
  -H "Authorization: Bearer ${NEW_ACCESS_TOKEN}"
echo -e "\n"

echo "=== 20. Logout (POST /auth/logout) ==="
curl -s -b "${COOKIE_JAR}" -c "${COOKIE_JAR}" -X POST "${BASE_URL}/auth/logout" | jq .
rm -f "${COOKIE_JAR}"
echo -e "\nDone!"
