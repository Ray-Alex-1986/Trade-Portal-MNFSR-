-- ============================================================================
-- 003_public_portal_stats.sql
-- Run AFTER 001_portal_updates.sql.
-- Exposes only non-identifying aggregate metrics for the public landing page.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_public_portal_stats()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH months AS (
    SELECT date_trunc('month', CURRENT_DATE) - (INTERVAL '1 month' * series) AS month_start
    FROM generate_series(11, 0, -1) AS series
  ),
  monthly AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'month', to_char(month_start, 'Mon'),
          'submissions', submission_count,
          'value', export_value_usd
        ) ORDER BY month_start
      ),
      '[]'::jsonb
    ) AS data
    FROM (
      SELECT
        months.month_start,
        COUNT(export_records.id)::INTEGER AS submission_count,
        COALESCE(SUM(
          export_records.estimated_value * CASE UPPER(COALESCE(export_records.currency, 'USD'))
            WHEN 'PKR' THEN 1.0 / 278
            WHEN 'EUR' THEN 1.08
            WHEN 'GBP' THEN 1.27
            WHEN 'AED' THEN 0.272294
            ELSE 1
          END
        ), 0) AS export_value_usd
      FROM months
      LEFT JOIN export_records
        ON export_records.created_at >= months.month_start
       AND export_records.created_at < months.month_start + INTERVAL '1 month'
      GROUP BY months.month_start
    ) monthly_rows
  ),
  top_products AS (
    SELECT COALESCE(
      jsonb_agg(jsonb_build_object('name', name, 'value', record_count) ORDER BY record_count DESC, name),
      '[]'::jsonb
    ) AS data
    FROM (
      SELECT product AS name, COUNT(*)::INTEGER AS record_count
      FROM export_records
      WHERE COALESCE(product, '') <> ''
      GROUP BY product
      ORDER BY record_count DESC, name
      LIMIT 8
    ) product_rows
  ),
  destination_countries AS (
    SELECT COALESCE(
      jsonb_agg(jsonb_build_object('name', name, 'value', record_count) ORDER BY record_count DESC, name),
      '[]'::jsonb
    ) AS data
    FROM (
      SELECT destination_country AS name, COUNT(*)::INTEGER AS record_count
      FROM export_records
      WHERE COALESCE(destination_country, '') <> ''
      GROUP BY destination_country
      ORDER BY record_count DESC, name
      LIMIT 8
    ) country_rows
  )
  SELECT jsonb_build_object(
    'registered_exporters', (SELECT COUNT(*)::INTEGER FROM companies WHERE status = 'approved'),
    'active_users', (SELECT COUNT(*)::INTEGER FROM profiles WHERE is_active = TRUE),
    'total_consignments', (SELECT COUNT(*)::INTEGER FROM export_records),
    'total_quantity', (SELECT COALESCE(SUM(quantity), 0) FROM export_records),
    'countries_served', (SELECT COUNT(DISTINCT destination_country)::INTEGER FROM export_records WHERE COALESCE(destination_country, '') <> ''),
    'pending_verifications', (SELECT COUNT(*)::INTEGER FROM companies WHERE status IN ('submitted', 'under_tdap_review', 'under_nafsa_review', 'additional_info_required')),
    'complaints_received', (SELECT COUNT(*)::INTEGER FROM complaints),
    'complaints_resolved', (SELECT COUNT(*)::INTEGER FROM complaints WHERE resolved_at IS NOT NULL OR status IN ('resolved', 'closed')),
    'monthly', (SELECT data FROM monthly),
    'products', (SELECT data FROM top_products),
    'countries', (SELECT data FROM destination_countries)
  );
$$;

REVOKE ALL ON FUNCTION public.get_public_portal_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_portal_stats() TO anon, authenticated;
