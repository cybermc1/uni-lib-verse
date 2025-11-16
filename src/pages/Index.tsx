import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { SearchBar } from '@/components/SearchBar';
import { BookCard } from '@/components/BookCard';
import { supabase } from '@/integrations/supabase/client';
import { BookOpen, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [books, setBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    fetchBooks();
  }, []);

  const fetchBooks = async () => {
    setLoading(true);
    try {
      const { data: booksData, error } = await supabase
        .from('books')
        .select('*')
        .order('title', { ascending: true })
        .limit(12);

      if (error) throw error;

      // Fetch review statistics for each book
      const booksWithReviews = await Promise.all(
        (booksData || []).map(async (book) => {
          const { data: reviewsData } = await supabase
            .from('reviews')
            .select('rating')
            .eq('book_id', book.id);

          const reviewCount = reviewsData?.length || 0;
          const averageRating = reviewCount > 0
            ? reviewsData.reduce((sum, r) => sum + r.rating, 0) / reviewCount
            : 0;

          return {
            ...book,
            reviewCount,
            averageRating,
          };
        })
      );

      setBooks(booksWithReviews);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to fetch books',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (query: string, searchType: string) => {
    if (!query.trim()) {
      fetchBooks();
      return;
    }

    setSearching(true);
    try {
      let queryBuilder = supabase.from('books').select('*');

      switch (searchType) {
        case 'title':
          queryBuilder = queryBuilder.ilike('title', `%${query}%`);
          break;
        case 'author':
          queryBuilder = queryBuilder.ilike('author', `%${query}%`);
          break;
        case 'publisher':
          queryBuilder = queryBuilder.ilike('publisher', `%${query}%`);
          break;
        case 'tags':
          queryBuilder = queryBuilder.contains('tags', [query]);
          break;
        case 'topics':
          queryBuilder = queryBuilder.contains('topics', [query]);
          break;
        default:
          queryBuilder = queryBuilder.or(
            `title.ilike.%${query}%,author.ilike.%${query}%,publisher.ilike.%${query}%,description.ilike.%${query}%`
          );
      }

      const { data, error } = await queryBuilder.order('title', { ascending: true });

      if (error) throw error;

      // Fetch review statistics for search results
      const booksWithReviews = await Promise.all(
        (data || []).map(async (book) => {
          const { data: reviewsData } = await supabase
            .from('reviews')
            .select('rating')
            .eq('book_id', book.id);

          const reviewCount = reviewsData?.length || 0;
          const averageRating = reviewCount > 0
            ? reviewsData.reduce((sum, r) => sum + r.rating, 0) / reviewCount
            : 0;

          return {
            ...book,
            reviewCount,
            averageRating,
          };
        })
      );

      setBooks(booksWithReviews);
      
      if (data?.length === 0) {
        toast({
          title: 'No results',
          description: 'No books found matching your search criteria',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Search Error',
        description: 'Failed to search books',
        variant: 'destructive',
      });
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero Section */}
      <section className="bg-gradient-primary text-white py-20">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold mb-4 animate-fade-in">
            Welcome to University Library
          </h1>
          <p className="text-xl mb-8 text-white/90 animate-fade-in">
            Discover thousands of books, journals, and research materials
          </p>
          
          <div className="flex justify-center animate-fade-in">
            <SearchBar onSearch={handleSearch} />
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-8 bg-secondary/50">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            <div className="p-6">
              <BookOpen className="h-12 w-12 mx-auto mb-3 text-primary" />
              <h3 className="text-3xl font-bold text-primary">15+</h3>
              <p className="text-muted-foreground">Books Available</p>
            </div>
            <div className="p-6">
              <BookOpen className="h-12 w-12 mx-auto mb-3 text-accent" />
              <h3 className="text-3xl font-bold text-accent">5+</h3>
              <p className="text-muted-foreground">Online Resources</p>
            </div>
            <div className="p-6">
              <BookOpen className="h-12 w-12 mx-auto mb-3 text-primary-light" />
              <h3 className="text-3xl font-bold text-primary-light">24/7</h3>
              <p className="text-muted-foreground">Access Available</p>
            </div>
          </div>
        </div>
      </section>

      {/* Books Section */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-8 text-center">
            {searching ? 'Searching...' : 'Browse Our Collection'}
          </h2>

          {(loading || searching) ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {books.map((book) => (
                <BookCard key={book.id} book={book} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Index;
