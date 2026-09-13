USE agx_service_portal;

INSERT INTO services
  (name, slug, short_description, description, category, base_price, display_order)
VALUES
  ('GST Registration', 'gst-registration',
   'Complete GST registration assistance.',
   'End-to-end assistance for GST registration and related documentation.',
   'GST', 999.00, 1),
  ('Income Tax Return', 'income-tax-return',
   'Professional ITR preparation and filing.',
   'Preparation, review and filing assistance for eligible income tax returns.',
   'Income Tax', 799.00, 2),
  ('Accounting & Bookkeeping', 'accounting-bookkeeping',
   'Monthly accounting and bookkeeping support.',
   'Organized bookkeeping and accounting support for businesses and professionals.',
   'Accounting', 1499.00, 3),
  ('Tax Consultation', 'tax-consultation',
   'Personalized tax planning and consultation.',
   'Professional consultation for tax planning, compliance and general tax queries.',
   'Consultation', 499.00, 4),
  ('Business Registration', 'business-registration',
   'Assistance with business registration.',
   'Guidance and documentation support for common business registration requirements.',
   'Business', 1999.00, 5),
  ('TDS & Compliance', 'tds-compliance',
   'TDS return and compliance assistance.',
   'Support for TDS-related filing and routine compliance requirements.',
   'Compliance', 999.00, 6)
ON DUPLICATE KEY UPDATE
  short_description = VALUES(short_description),
  description = VALUES(description),
  category = VALUES(category),
  base_price = VALUES(base_price),
  is_active = 1,
  display_order = VALUES(display_order);
