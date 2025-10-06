-- Create function to decrement available copies
CREATE OR REPLACE FUNCTION public.decrement_available_copies(book_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.books
  SET available_copies = GREATEST(available_copies - 1, 0)
  WHERE id = book_id;
END;
$$;

-- Create function to increment available copies
CREATE OR REPLACE FUNCTION public.increment_available_copies(book_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.books
  SET available_copies = LEAST(available_copies + 1, total_copies)
  WHERE id = book_id;
END;
$$;