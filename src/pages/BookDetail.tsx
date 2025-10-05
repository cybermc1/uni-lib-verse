import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  BookOpen, 
  User, 
  Building2, 
  Calendar, 
  FileText, 
  MapPin, 
  Eye, 
  Bookmark,
  ArrowLeft,
  Loader2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const BookDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [book, setBook] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [borrowing, setBorrowing] = useState(false);
  const [reserving, setReserving] = useState(false);

  useEffect(() => {
    if (id) {
      fetchBook();
    }
  }, [id]);

  const fetchBook = async () => {
    try {
      const { data, error } = await supabase
        .from('books')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setBook(data);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to fetch book details',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBorrow = async () => {
    if (!user) {
      toast({
        title: 'Authentication Required',
        description: 'Please sign in to borrow books',
        variant: 'destructive',
      });
      navigate('/auth');
      return;
    }

    setBorrowing(true);
    try {
      const { error } = await supabase.from('borrowing_records').insert({
        user_id: user.id,
        book_id: book.id,
        status: book.requires_approval ? 'pending' : 'active',
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: book.requires_approval 
          ? 'Borrowing request submitted for librarian approval' 
          : 'Book borrowed successfully',
      });
      
      fetchBook();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to borrow book',
        variant: 'destructive',
      });
    } finally {
      setBorrowing(false);
    }
  };

  const handleReserve = async () => {
    if (!user) {
      toast({
        title: 'Authentication Required',
        description: 'Please sign in to reserve books',
        variant: 'destructive',
      });
      navigate('/auth');
      return;
    }

    setReserving(true);
    try {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 7);

      const { error } = await supabase.from('reservations').insert({
        user_id: user.id,
        book_id: book.id,
        expiry_date: expiryDate.toISOString(),
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Book reserved successfully',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to reserve book',
        variant: 'destructive',
      });
    } finally {
      setReserving(false);
    }
  };

  const handleViewOnline = () => {
    if (!user) {
      toast({
        title: 'Authentication Required',
        description: 'Please sign in to view online materials',
        variant: 'destructive',
      });
      navigate('/auth');
      return;
    }

    if (book.pdf_url) {
      window.open(book.pdf_url, '_blank');
    } else {
      toast({
        title: 'Not Available',
        description: 'Online version not available for this material',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-20 flex justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-20 text-center">
          <h2 className="text-2xl font-bold">Book not found</h2>
        </div>
      </div>
    );
  }

  const isAvailable = book.available_copies > 0;
  const hasOnlineAccess = book.access_type === 'online_only' || book.access_type === 'both';

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Catalog
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Book Cover */}
          <div className="lg:col-span-1">
            <Card>
              <CardContent className="p-6">
                <div className="aspect-[3/4] bg-gradient-to-br from-primary-light to-primary rounded-lg flex items-center justify-center mb-4">
                  {book.cover_image_url ? (
                    <img src={book.cover_image_url} alt={book.title} className="w-full h-full object-cover rounded-lg" />
                  ) : (
                    <BookOpen className="h-32 w-32 text-white opacity-50" />
                  )}
                </div>

                <div className="space-y-3">
                  {isAvailable ? (
                    <Button onClick={handleBorrow} className="w-full" disabled={borrowing}>
                      {borrowing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {book.requires_approval ? 'Request to Borrow' : 'Borrow Now'}
                    </Button>
                  ) : (
                    <Button onClick={handleReserve} variant="secondary" className="w-full" disabled={reserving}>
                      {reserving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      <Bookmark className="mr-2 h-4 w-4" />
                      Reserve
                    </Button>
                  )}

                  {hasOnlineAccess && (
                    <Button onClick={handleViewOnline} variant="outline" className="w-full">
                      <Eye className="mr-2 h-4 w-4" />
                      View Online
                    </Button>
                  )}
                </div>

                <Separator className="my-4" />

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Availability:</span>
                    <span className={isAvailable ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                      {book.available_copies} / {book.total_copies}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Max Borrow:</span>
                    <span className="font-medium">{book.max_borrow_days} days</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Book Details */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap gap-2 mb-4">
                  <Badge variant="outline">
                    <FileText className="h-3 w-3 mr-1" />
                    {book.type.replace('_', ' ')}
                  </Badge>
                  {hasOnlineAccess ? (
                    <Badge className="bg-accent">
                      <Eye className="h-3 w-3 mr-1" />
                      Online Access
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      <MapPin className="h-3 w-3 mr-1" />
                      Physical Only
                    </Badge>
                  )}
                  {book.requires_approval && (
                    <Badge variant="destructive">Requires Approval</Badge>
                  )}
                </div>
                <CardTitle className="text-3xl">{book.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-start space-x-3">
                    <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Author</p>
                      <p className="font-medium">{book.author}</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Publisher</p>
                      <p className="font-medium">{book.publisher}</p>
                    </div>
                  </div>

                  {book.isbn && (
                    <div className="flex items-start space-x-3">
                      <BookOpen className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm text-muted-foreground">ISBN</p>
                        <p className="font-medium">{book.isbn}</p>
                      </div>
                    </div>
                  )}

                  {book.publication_year && (
                    <div className="flex items-start space-x-3">
                      <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm text-muted-foreground">Publication Year</p>
                        <p className="font-medium">{book.publication_year}</p>
                      </div>
                    </div>
                  )}
                </div>

                {book.description && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="font-semibold text-lg mb-2">Description</h3>
                      <p className="text-muted-foreground leading-relaxed">{book.description}</p>
                    </div>
                  </>
                )}

                {book.topics && book.topics.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="font-semibold text-lg mb-2">Topics</h3>
                      <div className="flex flex-wrap gap-2">
                        {book.topics.map((topic: string, i: number) => (
                          <Badge key={i} variant="secondary">{topic}</Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {book.tags && book.tags.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="font-semibold text-lg mb-2">Tags</h3>
                      <div className="flex flex-wrap gap-2">
                        {book.tags.map((tag: string, i: number) => (
                          <Badge key={i} variant="outline">{tag}</Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookDetail;
