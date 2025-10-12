-- Allow librarians and admins to view all profiles
CREATE POLICY "Librarians and admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'librarian'::app_role) 
  OR has_role(auth.uid(), 'admin'::app_role)
);