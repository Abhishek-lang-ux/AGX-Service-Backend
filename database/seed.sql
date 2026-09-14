INSERT INTO services
  (name, slug, short_description, description, category, base_price, display_order)
VALUES
  (
    'GST Registration',
    'gst-registration',
    'Complete GST registration assistance.',
    'End-to-end assistance for GST registration and related documentation.',
    'GST',
    999.00,
    1
  ),
  (
    'Income Tax Return',
    'income-tax-return',
    'Professional ITR preparation and filing.',
    'Preparation, review and filing assistance for eligible income tax returns.',
    'Income Tax',
    799.00,
    2
  ),
  (
    'Accounting & Bookkeeping',
    'accounting-bookkeeping',
    'Monthly accounting and bookkeeping support.',
    'Organized bookkeeping and accounting support for businesses and professionals.',
    'Accounting',
    1499.00,
    3
  ),
  (
    'Tax Consultation',
    'tax-consultation',
    'Personalized tax planning and consultation.',
    'Professional consultation for tax planning, compliance and general tax queries.',
    'Consultation',
    499.00,
    4
  ),
  (
    'Business Registration',
    'business-registration',
    'Assistance with business registration.',
    'Guidance and documentation support for common business registration requirements.',
    'Business',
    1999.00,
    5
  ),
  (
    'TDS & Compliance',
    'tds-compliance',
    'TDS return and compliance assistance.',
    'Support for TDS-related filing and routine compliance requirements.',
    'Compliance',
    999.00,
    6
  ),
  (
    'Website Development',
    'website-development',
    'Professional website development for businesses and professionals.',
    'Modern, responsive and mobile-friendly website development for businesses, startups, professionals and personal brands.',
    'Digital',
    4999.00,
    7
  ),
  (
    'PF Withdrawal Assistance',
    'pf-withdrawal',
    'Assistance with PF withdrawal and applicable EPFO processes.',
    'Guidance and assistance with PF withdrawal claims, required documentation and applicable EPFO-related processes.',
    'Documents',
    499.00,
    8
  ),
  (
    'E-commerce Website',
    'ecommerce-website',
    'Complete online store development.',
    'Professional e-commerce website development with product management, customer features and payment integration.',
    'Digital',
    9999.00,
    9
  ),
  (
    'PAN Card Services',
    'pan-card-services',
    'PAN application, correction and reprint assistance.',
    'Assistance with new PAN applications, corrections, reprints and applicable PAN-related processes.',
    'Documents',
    299.00,
    10
  )
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  short_description = VALUES(short_description),
  description = VALUES(description),
  category = VALUES(category),
  base_price = VALUES(base_price),
  is_active = 1,
  display_order = VALUES(display_order);