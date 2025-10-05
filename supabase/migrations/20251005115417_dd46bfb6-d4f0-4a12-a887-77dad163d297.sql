-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('student', 'librarian', 'admin');

-- Create enum for book types
CREATE TYPE public.book_type AS ENUM ('book', 'magazine', 'journal', 'research_paper', 'thesis');

-- Create enum for material access
CREATE TYPE public.access_type AS ENUM ('physical_only', 'online_only', 'both');

-- Create enum for borrowing status
CREATE TYPE public.borrowing_status AS ENUM ('pending', 'approved', 'rejected', 'active', 'returned', 'overdue');

-- Create enum for reservation status
CREATE TYPE public.reservation_status AS ENUM ('active', 'fulfilled', 'cancelled', 'expired');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  student_id TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- Create books table
CREATE TABLE public.books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  publisher TEXT NOT NULL,
  isbn TEXT UNIQUE,
  publication_year INTEGER,
  edition TEXT,
  pages INTEGER,
  language TEXT DEFAULT 'English',
  type book_type NOT NULL DEFAULT 'book',
  access_type access_type NOT NULL DEFAULT 'physical_only',
  description TEXT,
  cover_image_url TEXT,
  pdf_url TEXT,
  tags TEXT[] DEFAULT '{}',
  topics TEXT[] DEFAULT '{}',
  total_copies INTEGER NOT NULL DEFAULT 1,
  available_copies INTEGER NOT NULL DEFAULT 1,
  requires_approval BOOLEAN DEFAULT FALSE,
  max_borrow_days INTEGER DEFAULT 14,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (available_copies <= total_copies),
  CHECK (available_copies >= 0)
);

-- Create borrowing_records table
CREATE TABLE public.borrowing_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  status borrowing_status NOT NULL DEFAULT 'pending',
  request_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approval_date TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  borrow_date TIMESTAMPTZ,
  due_date TIMESTAMPTZ,
  return_date TIMESTAMPTZ,
  renewal_count INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create reservations table
CREATE TABLE public.reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  status reservation_status NOT NULL DEFAULT 'active',
  reservation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expiry_date TIMESTAMPTZ NOT NULL,
  fulfilled_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, book_id, status)
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.borrowing_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for books
CREATE POLICY "Anyone can view books"
  ON public.books FOR SELECT
  USING (true);

CREATE POLICY "Librarians and admins can insert books"
  ON public.books FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'librarian') OR 
    public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Librarians and admins can update books"
  ON public.books FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'librarian') OR 
    public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins can delete books"
  ON public.books FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for borrowing_records
CREATE POLICY "Users can view their own borrowing records"
  ON public.borrowing_records FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Librarians and admins can view all borrowing records"
  ON public.borrowing_records FOR SELECT
  USING (
    public.has_role(auth.uid(), 'librarian') OR 
    public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Authenticated users can create borrowing requests"
  ON public.borrowing_records FOR INSERT
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Users can update their own borrowing records"
  ON public.borrowing_records FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Librarians and admins can update all borrowing records"
  ON public.borrowing_records FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'librarian') OR 
    public.has_role(auth.uid(), 'admin')
  );

-- RLS Policies for reservations
CREATE POLICY "Users can view their own reservations"
  ON public.reservations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Librarians and admins can view all reservations"
  ON public.reservations FOR SELECT
  USING (
    public.has_role(auth.uid(), 'librarian') OR 
    public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Authenticated users can create reservations"
  ON public.reservations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can cancel their own reservations"
  ON public.reservations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Librarians and admins can update all reservations"
  ON public.reservations FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'librarian') OR 
    public.has_role(auth.uid(), 'admin')
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_books_updated_at
  BEFORE UPDATE ON public.books
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_borrowing_records_updated_at
  BEFORE UPDATE ON public.borrowing_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_reservations_updated_at
  BEFORE UPDATE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    NEW.email
  );
  
  -- Assign default student role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'student');
  
  RETURN NEW;
END;
$$;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create indexes for better performance
CREATE INDEX idx_books_title ON public.books(title);
CREATE INDEX idx_books_author ON public.books(author);
CREATE INDEX idx_books_publisher ON public.books(publisher);
CREATE INDEX idx_books_tags ON public.books USING GIN(tags);
CREATE INDEX idx_books_topics ON public.books USING GIN(topics);
CREATE INDEX idx_borrowing_records_user_id ON public.borrowing_records(user_id);
CREATE INDEX idx_borrowing_records_book_id ON public.borrowing_records(book_id);
CREATE INDEX idx_borrowing_records_status ON public.borrowing_records(status);
CREATE INDEX idx_reservations_user_id ON public.reservations(user_id);
CREATE INDEX idx_reservations_book_id ON public.reservations(book_id);
CREATE INDEX idx_reservations_status ON public.reservations(status);

-- Insert sample academic books and materials
INSERT INTO public.books (title, author, publisher, isbn, publication_year, type, access_type, description, tags, topics, total_copies, available_copies, requires_approval, max_borrow_days) VALUES
('Introduction to Algorithms', 'Thomas H. Cormen, Charles E. Leiserson', 'MIT Press', '978-0262033848', 2009, 'book', 'both', 'Comprehensive textbook on computer algorithms covering a broad range of algorithms in depth.', ARRAY['algorithms', 'computer science', 'data structures'], ARRAY['Computer Science', 'Mathematics'], 5, 5, false, 21),
('Clean Code: A Handbook of Agile Software Craftsmanship', 'Robert C. Martin', 'Prentice Hall', '978-0132350884', 2008, 'book', 'physical_only', 'A guide to producing readable, reusable, and refactorable software.', ARRAY['programming', 'software engineering', 'best practices'], ARRAY['Computer Science', 'Software Engineering'], 3, 2, false, 14),
('The Structure of Scientific Revolutions', 'Thomas S. Kuhn', 'University of Chicago Press', '978-0226458083', 2012, 'book', 'both', 'Landmark study in the history of science and philosophy of science.', ARRAY['philosophy', 'science', 'history'], ARRAY['Philosophy', 'History of Science'], 4, 3, false, 21),
('Principles of Economics', 'N. Gregory Mankiw', 'Cengage Learning', '978-1305585126', 2017, 'book', 'physical_only', 'Introduction to economics principles with real-world applications.', ARRAY['economics', 'microeconomics', 'macroeconomics'], ARRAY['Economics', 'Business'], 8, 6, false, 14),
('Organic Chemistry', 'Paula Yurkanis Bruice', 'Pearson', '978-0134042282', 2016, 'book', 'both', 'Comprehensive organic chemistry textbook with problem-solving emphasis.', ARRAY['chemistry', 'organic chemistry', 'science'], ARRAY['Chemistry', 'Science'], 6, 4, false, 21),
('The Art of Computer Programming, Vol. 1', 'Donald E. Knuth', 'Addison-Wesley', '978-0201896831', 1997, 'book', 'online_only', 'Fundamental algorithms and analysis of algorithms.', ARRAY['algorithms', 'computer science', 'programming'], ARRAY['Computer Science', 'Mathematics'], 2, 2, true, 30),
('Nature: International Journal of Science', 'Nature Publishing Group', 'Springer Nature', NULL, 2024, 'journal', 'online_only', 'Weekly international journal publishing peer-reviewed research.', ARRAY['science', 'research', 'peer-reviewed'], ARRAY['Science', 'Research'], 1, 1, false, 7),
('Harvard Business Review', 'Harvard Business Publishing', 'Harvard Business School', NULL, 2024, 'magazine', 'both', 'Magazine on business management practices and trends.', ARRAY['business', 'management', 'leadership'], ARRAY['Business', 'Management'], 12, 10, false, 7),
('Machine Learning: A Probabilistic Perspective', 'Kevin P. Murphy', 'MIT Press', '978-0262018029', 2012, 'book', 'both', 'Comprehensive introduction to machine learning from a probabilistic perspective.', ARRAY['machine learning', 'AI', 'statistics'], ARRAY['Computer Science', 'Artificial Intelligence'], 4, 3, false, 21),
('The Elements of Style', 'William Strunk Jr., E.B. White', 'Pearson', '978-0205309023', 1999, 'book', 'physical_only', 'Classic guide to English style and composition.', ARRAY['writing', 'grammar', 'composition'], ARRAY['English', 'Writing'], 10, 8, false, 14),
('Calculus: Early Transcendentals', 'James Stewart', 'Cengage Learning', '978-1285741550', 2015, 'book', 'both', 'Widely used calculus textbook with clear explanations.', ARRAY['calculus', 'mathematics', 'analysis'], ARRAY['Mathematics'], 12, 9, false, 21),
('Physics for Scientists and Engineers', 'Raymond A. Serway', 'Cengage Learning', '978-1133947271', 2013, 'book', 'physical_only', 'Comprehensive physics textbook covering mechanics to modern physics.', ARRAY['physics', 'science', 'engineering'], ARRAY['Physics', 'Engineering'], 7, 5, false, 21),
('Deep Learning Research Papers Collection', 'Various Authors', 'Academic Press', NULL, 2023, 'research_paper', 'online_only', 'Collection of seminal papers in deep learning and neural networks.', ARRAY['deep learning', 'neural networks', 'AI'], ARRAY['Computer Science', 'Artificial Intelligence'], 1, 1, true, 14),
('The Oxford Handbook of Political Science', 'Robert E. Goodin', 'Oxford University Press', '978-0199604456', 2011, 'book', 'both', 'Comprehensive overview of political science disciplines.', ARRAY['politics', 'government', 'social science'], ARRAY['Political Science', 'Social Sciences'], 3, 2, false, 21),
('Modern Database Management', 'Jeffrey A. Hoffer', 'Pearson', '978-0134773650', 2018, 'book', 'physical_only', 'Introduction to database design, development, and management.', ARRAY['database', 'SQL', 'information systems'], ARRAY['Computer Science', 'Information Systems'], 5, 4, false, 14);