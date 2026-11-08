"""Aggregate product metrics from the Luminexa Postgres schema (read-only).

Activity feeds / charts honor OPS_DASHBOARD_HISTORY_SINCE so the dashboard can
start “clean” without deleting app data. Account directories still show active users.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone

from .db import fetch_all, fetch_one
from .traffic import load_traffic


def history_since() -> datetime:
    raw = (os.environ.get('OPS_DASHBOARD_HISTORY_SINCE') or '').strip()
    if raw:
        # Accept ISO-8601; treat naive as UTC.
        value = datetime.fromisoformat(raw.replace('Z', '+00:00'))
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)
    return datetime.now(timezone.utc)


def dashboard_payload() -> dict:
    since = history_since()

    # Live account census (not affected by history reset).
    accounts = fetch_one(
        """
        SELECT
          (SELECT COUNT(*) FROM accounts_user WHERE deleted_at IS NULL) AS users_total,
          (SELECT COUNT(DISTINCT u.id)
             FROM accounts_user u
             JOIN businesses_organizationmembership m ON m.user_id = u.id
             WHERE u.deleted_at IS NULL AND m.role IN ('owner', 'staff')
          ) AS users_business,
          (SELECT COUNT(*)
             FROM accounts_user u
             WHERE u.deleted_at IS NULL
               AND EXISTS (
                 SELECT 1 FROM businesses_organizationmembership m
                 WHERE m.user_id = u.id AND m.role = 'customer'
               )
               AND NOT EXISTS (
                 SELECT 1 FROM businesses_organizationmembership m2
                 WHERE m2.user_id = u.id AND m2.role IN ('owner', 'staff')
               )
          ) AS users_customer,
          (SELECT COUNT(*)
             FROM accounts_user u
             WHERE u.deleted_at IS NULL
               AND NOT EXISTS (
                 SELECT 1 FROM businesses_organizationmembership m
                 WHERE m.user_id = u.id
               )
          ) AS users_no_role,
          (SELECT COUNT(*) FROM businesses_organization WHERE is_active) AS orgs_active,
          (SELECT COUNT(*) FROM businesses_organization) AS orgs_total
        """
    ) or {}

    # Activity since history reset (logs / charts KPIs).
    totals = fetch_one(
        """
        SELECT
          (SELECT COUNT(*) FROM accounts_user
             WHERE deleted_at IS NULL AND date_joined >= %(since)s) AS users,
          (SELECT COUNT(*) FROM accounts_user
             WHERE deleted_at IS NULL AND date_joined >= GREATEST(%(since)s, NOW() - INTERVAL '1 day')) AS users_1d,
          (SELECT COUNT(*) FROM accounts_user
             WHERE deleted_at IS NULL AND date_joined >= GREATEST(%(since)s, NOW() - INTERVAL '7 day')) AS users_7d,
          (SELECT COUNT(*) FROM accounts_user
             WHERE deleted_at IS NULL AND date_joined >= GREATEST(%(since)s, NOW() - INTERVAL '30 day')) AS users_30d,
          (SELECT COUNT(*) FROM businesses_organization
             WHERE created_at >= %(since)s) AS orgs,
          (SELECT COUNT(*) FROM businesses_organization
             WHERE created_at >= GREATEST(%(since)s, NOW() - INTERVAL '30 day')) AS orgs_30d,
          (SELECT COUNT(*) FROM jobs_booking
             WHERE created_at >= %(since)s) AS bookings,
          (SELECT COUNT(*) FROM jobs_booking
             WHERE created_at >= GREATEST(%(since)s, NOW() - INTERVAL '1 day')) AS bookings_1d,
          (SELECT COUNT(*) FROM jobs_booking
             WHERE created_at >= GREATEST(%(since)s, NOW() - INTERVAL '7 day')) AS bookings_7d,
          (SELECT COUNT(*) FROM jobs_booking
             WHERE created_at >= GREATEST(%(since)s, NOW() - INTERVAL '30 day')) AS bookings_30d,
          (SELECT COUNT(*) FROM accounts_safetyreport
             WHERE created_at >= %(since)s) AS safety_reports,
          (SELECT COUNT(*) FROM accounts_devicepushtoken t
             JOIN accounts_user u ON u.id = t.user_id
             WHERE t.platform = 'android' AND u.deleted_at IS NULL
               AND t.created_at >= %(since)s) AS push_android,
          (SELECT COUNT(*) FROM accounts_devicepushtoken t
             JOIN accounts_user u ON u.id = t.user_id
             WHERE t.platform = 'ios' AND u.deleted_at IS NULL
               AND t.created_at >= %(since)s) AS push_ios,
          (SELECT COUNT(*) FROM accounts_authtoken
             WHERE created >= %(since)s) AS auth_tokens,
          (SELECT COUNT(*) FROM accounts_logincode
             WHERE created_at >= GREATEST(%(since)s, NOW() - INTERVAL '7 day')) AS login_codes_7d
        """,
        {'since': since},
    ) or {}

    # Live directories (active accounts) — not historical logs.
    business_users = fetch_all(
        """
        SELECT
          u.date_joined,
          u.email,
          COALESCE(NULLIF(TRIM(u.full_name), ''),
                   NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''),
                   '(no name)') AS name,
          u.email_verified,
          STRING_AGG(m.role || '@' || o.name, ', ' ORDER BY o.name) AS roles
        FROM accounts_user u
        JOIN businesses_organizationmembership m ON m.user_id = u.id
        JOIN businesses_organization o ON o.id = m.organization_id
        WHERE u.deleted_at IS NULL
          AND m.role IN ('owner', 'staff')
        GROUP BY u.id, u.date_joined, u.email, u.full_name, u.first_name, u.last_name, u.email_verified
        ORDER BY u.date_joined DESC
        """
    )

    customer_only = fetch_all(
        """
        SELECT
          u.date_joined,
          u.email,
          COALESCE(NULLIF(TRIM(u.full_name), ''),
                   NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''),
                   '(no name)') AS name,
          u.email_verified,
          STRING_AGG(o.name || ' [' || COALESCE(NULLIF(m.customer_status, ''), '-') || ']',
                     ', ' ORDER BY o.name) AS orgs
        FROM accounts_user u
        JOIN businesses_organizationmembership m ON m.user_id = u.id
        JOIN businesses_organization o ON o.id = m.organization_id
        WHERE u.deleted_at IS NULL
          AND m.role = 'customer'
          AND NOT EXISTS (
            SELECT 1 FROM businesses_organizationmembership m2
            WHERE m2.user_id = u.id AND m2.role IN ('owner', 'staff')
          )
        GROUP BY u.id, u.date_joined, u.email, u.full_name, u.first_name, u.last_name, u.email_verified
        ORDER BY u.date_joined DESC
        """
    )

    recent_users = fetch_all(
        """
        SELECT
          u.date_joined,
          u.email,
          COALESCE(NULLIF(TRIM(u.full_name), ''),
                   NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''),
                   '(no name)') AS name,
          u.email_verified,
          u.is_active,
          COALESCE((
            SELECT STRING_AGG(DISTINCT m.role, ', ')
            FROM businesses_organizationmembership m WHERE m.user_id = u.id
          ), 'none') AS roles
        FROM accounts_user u
        WHERE u.deleted_at IS NULL
          AND u.date_joined >= %(since)s
        ORDER BY u.date_joined DESC
        LIMIT 25
        """,
        {'since': since},
    )

    recent_orgs = fetch_all(
        """
        SELECT created_at, name, slug, is_active, profile_public, subscription_plan, timezone
        FROM businesses_organization
        WHERE created_at >= %(since)s
        ORDER BY created_at DESC
        LIMIT 20
        """,
        {'since': since},
    )

    recent_bookings = fetch_all(
        """
        SELECT
          b.created_at,
          b.status,
          b.source,
          o.name AS org_name,
          c.email AS customer_email
        FROM jobs_booking b
        JOIN businesses_organization o ON o.id = b.organization_id
        JOIN accounts_user c ON c.id = b.customer_id
        WHERE b.created_at >= %(since)s
        ORDER BY b.created_at DESC
        LIMIT 25
        """,
        {'since': since},
    )

    booking_status = fetch_all(
        """
        SELECT status, COUNT(*) AS c
        FROM jobs_booking
        WHERE created_at >= %(since)s
        GROUP BY status
        ORDER BY c DESC
        """,
        {'since': since},
    )

    signups_by_day = fetch_all(
        """
        SELECT DATE(date_joined AT TIME ZONE 'America/Toronto') AS day, COUNT(*) AS c
        FROM accounts_user
        WHERE deleted_at IS NULL
          AND date_joined >= %(since)s
        GROUP BY 1
        ORDER BY 1
        """,
        {'since': since},
    )

    bookings_by_day = fetch_all(
        """
        SELECT DATE(created_at AT TIME ZONE 'America/Toronto') AS day, COUNT(*) AS c
        FROM jobs_booking
        WHERE created_at >= %(since)s
        GROUP BY 1
        ORDER BY 1
        """,
        {'since': since},
    )

    push_devices = fetch_all(
        """
        SELECT
          t.platform,
          t.updated_at,
          u.email
        FROM accounts_devicepushtoken t
        JOIN accounts_user u ON u.id = t.user_id
        WHERE u.deleted_at IS NULL
          AND t.created_at >= %(since)s
        ORDER BY t.updated_at DESC
        LIMIT 20
        """,
        {'since': since},
    )

    admin_failures = fetch_all(
        """
        SELECT day, key, fail_count, alert_sent_at
        FROM accounts_adminloginfailureday
        WHERE created_at >= %(since)s
        ORDER BY day DESC, id DESC
        LIMIT 15
        """,
        {'since': since},
    )

    recent_logins = fetch_all(
        """
        SELECT created_at, email, attempt_count, consumed_at
        FROM accounts_logincode
        WHERE created_at >= %(since)s
        ORDER BY created_at DESC
        LIMIT 15
        """,
        {'since': since},
    )

    return {
        'history_since': since,
        'accounts': accounts,
        'totals': totals,
        'traffic': load_traffic(since),
        'business_users': business_users,
        'customer_only': customer_only,
        'recent_users': recent_users,
        'recent_orgs': recent_orgs,
        'recent_bookings': recent_bookings,
        'booking_status': booking_status,
        'signups_by_day': signups_by_day,
        'bookings_by_day': bookings_by_day,
        'push_devices': push_devices,
        'admin_failures': admin_failures,
        'recent_logins': recent_logins,
    }
