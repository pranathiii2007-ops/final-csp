-- Migration: Seller Profiles and Product Publishing FKEY Fix
-- 1. Ensure all auth.users have a profile row
INSERT INTO public.profiles (id, shop_name, area, phone)
SELECT
  id,
  COALESCE(raw_user_meta_data->>'shop_name', split_part(email, '@', 1), 'My Shop'),
  raw_user_meta_data->>'area',
  raw_user_meta_data->>'phone'
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- 2. Add business profile columns to public.profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS brand_name TEXT,
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}'::jsonb;

-- Populate brand_name and location from existing shop_name and area where empty
UPDATE public.profiles
SET
  brand_name = COALESCE(brand_name, shop_name),
  location = COALESCE(location, area)
WHERE brand_name IS NULL OR location IS NULL;

-- 3. Update handle_new_user() trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    shop_name,
    brand_name,
    area,
    location,
    phone
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'shop_name', split_part(NEW.email, '@', 1), 'My Shop'),
    COALESCE(NEW.raw_user_meta_data->>'brand_name', NEW.raw_user_meta_data->>'shop_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'area',
    COALESCE(NEW.raw_user_meta_data->>'location', NEW.raw_user_meta_data->>'area'),
    NEW.raw_user_meta_data->>'phone'
  )
  ON CONFLICT (id) DO UPDATE SET
    shop_name = EXCLUDED.shop_name,
    brand_name = COALESCE(profiles.brand_name, EXCLUDED.brand_name),
    phone = COALESCE(EXCLUDED.phone, profiles.phone);
  RETURN NEW;
END;
$$;

-- 4. Correct foreign key relationship for products_seller_id_fkey
-- This points products.seller_id to public.profiles(id) while retaining full integrity
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_seller_id_fkey;

ALTER TABLE public.products
  ADD CONSTRAINT products_seller_id_fkey
  FOREIGN KEY (seller_id)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;

-- 5. RLS Policies on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);
