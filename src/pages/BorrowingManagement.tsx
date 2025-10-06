import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle, XCircle, Loader2, RotateCcw, BookCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

const BorrowingManagement = () => {
  const { user, userRole } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [borrowings, setBorrowings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');

  useEffect(() => {
    if (!user || (userRole !== 'librarian' && userRole !== 'admin')) {
      navigate('/');
      return;
    }
    fetchBorrowings();
  }, [user, userRole, navigate, activeTab]);

  const fetchBorrowings = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('borrowing_records')
        .select('*, books(*), profiles(*)')
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
        description: 'Failed to fetch borrowing records',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (recordId: string, bookId: string, maxBorrowDays: number) => {
    try {
      const borrowDate = new Date();
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + maxBorrowDays);

      const { error: updateError } = await supabase
        .from('borrowing_records')
        .update({
          status: 'active',
          approved_by: user?.id,
          approval_date: borrowDate.toISOString(),
          borrow_date: borrowDate.toISOString(),
          due_date: dueDate.toISOString(),
        })
        .eq('id', recordId);

      if (updateError) throw updateError;

      const { error: bookError } = await supabase.rpc('decrement_available_copies' as any, {
        book_id: bookId,
      });

      if (bookError) throw bookError;

      toast({
        title: 'Success',
        description: 'Borrowing request approved',
      });

      fetchBorrowings();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to approve request',
        variant: 'destructive',
      });
    }
  };

  const handleReject = async (recordId: string) => {
    try {
      const { error } = await supabase
        .from('borrowing_records')
        .update({
          status: 'rejected',
          approved_by: user?.id,
          approval_date: new Date().toISOString(),
        })
        .eq('id', recordId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Request rejected',
      });

      fetchBorrowings();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to reject request',
        variant: 'destructive',
      });
    }
  };

  const handleReturn = async (recordId: string, bookId: string) => {
    try {
      const { error: updateError } = await supabase
        .from('borrowing_records')
        .update({
          status: 'returned',
          return_date: new Date().toISOString(),
        })
        .eq('id', recordId);

      if (updateError) throw updateError;

      const { error: bookError } = await supabase.rpc('increment_available_copies' as any, {
        book_id: bookId,
      });

      if (bookError) throw bookError;

      toast({
        title: 'Success',
        description: 'Book returned successfully',
      });

      fetchBorrowings();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to process return',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string, dueDate?: string) => {
    const isOverdue = dueDate && new Date(dueDate) < new Date() && status === 'active';
    
    if (isOverdue) {
      return <Badge variant="destructive">Overdue</Badge>;
    }

    switch (status) {
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      case 'active':
        return <Badge className="bg-blue-600">Active</Badge>;
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
          <BookCheck className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Borrowing Management</h1>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5 max-w-2xl">
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="returned">Returned</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
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
                          <CardTitle className="text-xl mb-2">{record.books.title}</CardTitle>
                          <p className="text-sm text-muted-foreground">by {record.books.author}</p>
                          <p className="text-sm text-muted-foreground mt-2">
                            Student: <span className="font-medium">{record.profiles.full_name}</span>
                            {record.profiles.student_id && ` (${record.profiles.student_id})`}
                          </p>
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
                            <p className="text-muted-foreground">Borrow Date</p>
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
                            <p className="text-muted-foreground">Return Date</p>
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

                      <div className="flex gap-2">
                        {record.status === 'pending' && (
                          <>
                            <Button
                              onClick={() => handleApprove(record.id, record.book_id, record.books.max_borrow_days)}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Approve
                            </Button>
                            <Button
                              onClick={() => handleReject(record.id)}
                              variant="destructive"
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Reject
                            </Button>
                          </>
                        )}
                        {record.status === 'active' && (
                          <Button
                            onClick={() => handleReturn(record.id, record.book_id)}
                            className="bg-blue-600 hover:bg-blue-700"
                          >
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Mark as Returned
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default BorrowingManagement;
