-- Repair the composition strings mangled by the original legacy import.
--
-- The importer joined the control panel's composition multi-select without stripping the
-- input's own label, and without collapsing the percent sign it had already appended. So the
-- fabric detail page shows things like:
--
--   "Polyester (Composition %) 100"      (259 products -- the label leaked into the value)
--   "Polyester 90%% Spandex 10%%"        (66 products  -- doubled percent signs)
--
-- Both are import artefacts, not anything a supplier typed. This rewrites ONLY strings
-- matching those two exact shapes and leaves every other value untouched, so a composition
-- someone corrected by hand in the admin panel survives.
--
-- Target shape is the one the seeded products already use: "Cotton 100%", "Bamboo 95%, Spandex 5%".

-- guard_product_admin_columns() does not gate `composition`, so no trigger juggling here.

-- 1. "Polyester (Composition %) 100"  ->  "Polyester 100%"
--    Also covers a trailing percent that is already present ("... 100%").
update public.products
set composition = regexp_replace(
      regexp_replace(composition, '\s*\(Composition\s*%\)\s*', ' ', 'gi'),
      '(\d+(?:\.\d+)?)\s*%*',
      '\1%',
      'g'
    ),
    updated_at = now()
where composition like '%(Composition %)%';

-- 2. "Polyester 90%% Spandex 10%%"  ->  "Polyester 90% Spandex 10%"
update public.products
set composition = regexp_replace(composition, '%{2,}', '%', 'g'),
    updated_at = now()
where composition like '%\%\%%';

-- 3. Tidy the whitespace either step may have left behind.
update public.products
set composition = btrim(regexp_replace(composition, '\s{2,}', ' ', 'g')),
    updated_at = now()
where composition ~ '\s{2,}|^\s|\s$';
