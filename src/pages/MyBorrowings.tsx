import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, BookOpen } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ReviewDialog } from '@/components/ReviewDialog';

const MyBorrowings = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [borrowings, setBorrowings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('active');
  const [confirmReturn, setConfirmReturn] = useState<{ recordId: string; bookId: string; bookTitle: string } | null>(null);
  const [reviewDialog, setReviewDialog] = useState<{ bookId: string; bookTitle: string } | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchMyBorrowings();
  }, [user, navigate, activeTab]);

  const fetchMyBorrowings = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('borrowing_records_with_details')
        .select('*')
        .eq('user_id', user?.id)
        .order('request_date', { ascending: false });

      if (activeTab !== 'all') {
        query = query.eq('status', activeTab as any);
      }

      const { data, error } = await query;

      if (error) throw error;
      setBorrowings(data || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to fetch your borrowing records',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReturn = async () => {
    if (!confirmReturn) return;

    try {
      const { error: updateError } = await supabase
        .from('borrowing_records')
        .update({
          status: 'returned',
          return_date: new Date().toISOString(),
        })
        .eq('id', confirmReturn.recordId);

      if (updateError) throw updateError;

      await supabase.rpc('increment_available_copies', { book_id: confirmReturn.bookId });

      toast({
        title: 'Success',
        description: 'Book returned successfully',
      });

      setConfirmReturn(null);
      setReviewDialog({ bookId: confirmReturn.bookId, bookTitle: confirmReturn.bookTitle });
      fetchMyBorrowings();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to return book',
        variant: 'destructive',
      });
      setConfirmReturn(null);
    }
  };

  const getStatusBadge = (status: string, dueDate?: string) => {
    const isOverdue = dueDate && new Date(dueDate) < new Date() && status === 'active';
    
    if (isOverdue) {
      return <Badge variant="destructive">Overdue</Badge>;
    }

    switch (status) {
      case 'pending':
        return <Badge variant="secondary">Pending Approval</Badge>;
      case 'active':
        return <Badge className="bg-blue-600">Currently Borrowed</Badge>;
      case 'returned':
        return <Badge className="bg-green-600">Returned</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge>{status}</Badge>;
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

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <BookOpen className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">My Borrowing History</h1>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 max-w-2xl">
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="returned">Returned</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="space-y-4 mt-6">
            {borrowings.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">No borrowing records found</p>
                </CardContent>
              </Card>
            ) : (
              borrowings.map((record) => {
                const isOverdue = record.due_date && new Date(record.due_date) < new Date() && record.status === 'active';
                
                return (
                  <Card key={record.id} className={isOverdue ? 'border-destructive' : ''}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-xl mb-2">{record.book?.title}</CardTitle>
                          <p className="text-sm text-muted-foreground">by {record.book?.author}</p>
                        </div>
                        {getStatusBadge(record.status, record.due_date)}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Request Date</p>
                          <p className="font-medium">{format(new Date(record.request_date), 'MMM dd, yyyy')}</p>
                        </div>
                        {record.borrow_date && (
                          <div>
                            <p className="text-muted-foreground">Borrowed On</p>
                            <p className="font-medium">{format(new Date(record.borrow_date), 'MMM dd, yyyy')}</p>
                          </div>
                        )}
                        {record.due_date && (
                          <div>
                            <p className="text-muted-foreground">Due Date</p>
                            <p className={`font-medium ${isOverdue ? 'text-destructive' : ''}`}>
                              {format(new Date(record.due_date), 'MMM dd, yyyy')}
                            </p>
                          </div>
                        )}
                        {record.return_date && (
                          <div>
                            <p className="text-muted-foreground">Returned On</p>
                            <p className="font-medium">{format(new Date(record.return_date), 'MMM dd, yyyy')}</p>
                          </div>
                        )}
                      </div>

                      {record.notes && (
                        <div className="text-sm">
                          <p className="text-muted-foreground">Notes</p>
                          <p className="mt-1">{record.notes}</p>
                        </div>
                      )}

                      {isOverdue && (
                        <div className="text-sm text-destructive font-medium">
                          ⚠️ This book is overdue. Please return it as soon as possible.
                        </div>
                      )}

                      {record.status === 'active' && (
                        <div className="flex justify-end">
                          <Button
                            onClick={() => setConfirmReturn({ 
                              recordId: record.id, 
                              bookId: record.book_id,
                              bookTitle: record.book?.title 
                            })}
                            variant="default"
                          >
                            Return Book
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog open={!!confirmReturn} onOpenChange={(open) => !open && setConfirmReturn(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Book Return</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to return "{confirmReturn?.bookTitle}"? This action will mark the book as returned and make it available for other users.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReturn}>
              Confirm Return
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ReviewDialog
        open={!!reviewDialog}
        onOpenChange={(open) => !open && setReviewDialog(null)}
        bookId={reviewDialog?.bookId || ''}
        bookTitle={reviewDialog?.bookTitle || ''}
      />
    </div>
  );
};

export default MyBorrowings;
