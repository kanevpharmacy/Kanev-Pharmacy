-- Allows a signed-in user to read ONLY their own admin membership row.
-- This is needed for the portal to verify role membership. It does not grant
-- product/order write permissions or allow users to view other administrators.
ALTER TABLE public.admin_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin reads own membership" ON public.admin_members;
CREATE POLICY "Admin reads own membership"
ON public.admin_members
FOR SELECT
TO authenticated
USING (user_id = auth.uid());
