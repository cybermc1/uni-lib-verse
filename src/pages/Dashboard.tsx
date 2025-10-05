import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { BookOpen, Calendar, RotateCcw, XCircle, Loader2, Clock, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [borrowingRecords, setBorrowingRecords] = useState<any[]>([]);
  const [reservations, setReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchUserData();
  }, [user, navigate]);

  const fetchUserData = async () => {
    setLoading(true);
    try {
      const [borrowingData, reservationData] = await Promise.all([
        supabase
          .from('borrowing_records')
          .select('*, books(*)')
          .eq('user_id', user?.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('reservations')
          .select('*, books(*)')
          .eq('user_id', user?.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false }),
      ]);

      if (borrowingData.error) throw borrowingData.error;
      if (reservationData.error) throw reservationData.error;

      setBorrowingRecords(borrowingData.data || []);
      setReservations(reservationData.data || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to fetch your data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRenew = async (recordId: string) => {
    try {
      const record = borrowingRecords.find(r => r.id === recordId);
      if (!record) return;

      if (record.renewal_count >= 2) {
        toast({
          title: 'Cannot Renew',
          description: 'Maximum renewal limit reached',
          variant: 'destructive',
        });
        return;
      }

      const newDueDate = new Date(record.due_date);
      newDueDate.setDate(newDueDate.getDate() + record.books.max_borrow_days);

      const { error } = await supabase
        .from('borrowing_records')
        .update({
          due_date: newDueDate.toISOString(),
          renewal_count: record.renewal_count + 1,
        })
        .eq('id', recordId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Book renewed successfully',
      });

      fetchUserData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to renew book',
        variant: 'destructive',
      });
    }
  };

  const handleCancelReservation = async (reservationId: string) => {
    try {
      const { error } = await supabase
        .from('reservations')
        .update({ status: 'cancelled' })
        .eq('id', reservationId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Reservation cancelled',
      });

      fetchUserData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to cancel reservation',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { variant: 'secondary' as const, label: 'Pending Approval', icon: Clock },
      approved: { variant: 'default' as const, label: 'Approved', icon: CheckCircle },
      active: { variant: 'default' as const, label: 'Active', icon: CheckCircle },
      returned: { variant: 'outline' as const, label: 'Returned', icon: CheckCircle },
      overdue: { variant: 'destructive' as const, label: 'Overdue', icon: XCircle },
      rejected: { variant: 'destructive' as const, label: 'Rejected', icon: XCircle },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
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
        <h1 className="text-3xl font-bold mb-8">My Dashboard</h1>

        <Tabs defaultValue="borrowed" className="space-y-6">
          <TabsList>
            <TabsTrigger value="borrowed">
              <BookOpen className="h-4 w-4 mr-2" />
              Borrowed Books ({borrowingRecords.filter(r => r.status === 'active' || r.status === 'pending').length})
            </TabsTrigger>
            <TabsTrigger value="reservations">
              <Calendar className="h-4 w-4 mr-2" />
              Reservations ({reservations.length})
            </TabsTrigger>
            <TabsTrigger value="history">
              <Clock className="h-4 w-4 mr-2" />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="borrowed" className="space-y-4">
            {borrowingRecords.filter(r => r.status === 'active' || r.status === 'pending').length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">You haven't borrowed any books yet</p>
                  <Button onClick={() => navigate('/')} className="mt-4">
                    Browse Catalog
                  </Button>
                </CardContent>
              </Card>
            ) : (
              borrowingRecords
                .filter(r => r.status === 'active' || r.status === 'pending')
                .map((record) => (
                  <Card key={record.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-xl mb-2">{record.books.title}</CardTitle>
                          <p className="text-sm text-muted-foreground">{record.books.author}</p>
                        </div>
                        {getStatusBadge(record.status)}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground mb-1">Request Date</p>
                          <p className="font-medium">{format(new Date(record.request_date), 'MMM dd, yyyy')}</p>
                        </div>
                        {record.borrow_date && (
                          <div>
                            <p className="text-muted-foreground mb-1">Borrowed On</p>
                            <p className="font-medium">{format(new Date(record.borrow_date), 'MMM dd, yyyy')}</p>
                          </div>
                        )}
                        {record.due_date && (
                          <div>
                            <p className="text-muted-foreground mb-1">Due Date</p>
                            <p className="font-medium">{format(new Date(record.due_date), 'MMM dd, yyyy')}</p>
                          </div>
                        )}
                        {record.status === 'active' && (
                          <div>
                            <p className="text-muted-foreground mb-1">Renewals</p>
                            <p className="font-medium">{record.renewal_count} / 2</p>
                          </div>
                        )}
                      </div>

                      {record.status === 'active' && (
                        <>
                          <Separator />
                          <div className="flex gap-2">
                            <Button
                              onClick={() => handleRenew(record.id)}
                              variant="outline"
                              size="sm"
                              disabled={record.renewal_count >= 2}
                            >
                              <RotateCcw className="h-4 w-4 mr-2" />
                              Renew
                            </Button>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                ))
            )}
          </TabsContent>

          <TabsContent value="reservations" className="space-y-4">
            {reservations.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">You don't have any active reservations</p>
                </CardContent>
              </Card>
            ) : (
              reservations.map((reservation) => (
                <Card key={reservation.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-xl mb-2">{reservation.books.title}</CardTitle>
                        <p className="text-sm text-muted-foreground">{reservation.books.author}</p>
                      </div>
                      <Badge>Active</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground mb-1">Reserved On</p>
                        <p className="font-medium">{format(new Date(reservation.reservation_date), 'MMM dd, yyyy')}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Expires On</p>
                        <p className="font-medium">{format(new Date(reservation.expiry_date), 'MMM dd, yyyy')}</p>
                      </div>
                    </div>
                    <Separator />
                    <Button
                      onClick={() => handleCancelReservation(reservation.id)}
                      variant="outline"
                      size="sm"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Cancel Reservation
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            {borrowingRecords.filter(r => r.status === 'returned' || r.status === 'rejected').length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No borrowing history yet</p>
                </CardContent>
              </Card>
            ) : (
              borrowingRecords
                .filter(r => r.status === 'returned' || r.status === 'rejected')
                .map((record) => (
                  <Card key={record.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-xl mb-2">{record.books.title}</CardTitle>
                          <p className="text-sm text-muted-foreground">{record.books.author}</p>
                        </div>
                        {getStatusBadge(record.status)}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground mb-1">Borrowed On</p>
                          <p className="font-medium">
                            {record.borrow_date ? format(new Date(record.borrow_date), 'MMM dd, yyyy') : 'N/A'}
                          </p>
                        </div>
                        {record.return_date && (
                          <div>
                            <p className="text-muted-foreground mb-1">Returned On</p>
                            <p className="font-medium">{format(new Date(record.return_date), 'MMM dd, yyyy')}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Dashboard;
