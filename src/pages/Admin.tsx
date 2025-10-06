import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle, XCircle, Loader2, UserCog, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const Admin = () => {
  const { user, userRole } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);

  useEffect(() => {
    if (!user || (userRole !== 'librarian' && userRole !== 'admin')) {
      navigate('/');
      return;
    }
    fetchPendingRequests();
    if (userRole === 'admin') {
      fetchUsers();
    }
  }, [user, userRole, navigate]);

  const fetchPendingRequests = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('borrowing_records')
        .select('*, books(*), profiles(*)')
        .eq('status', 'pending')
        .order('request_date', { ascending: true });

      if (error) throw error;
      setPendingRequests(data || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to fetch requests',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('*');

      if (rolesError) throw rolesError;

      const usersWithRoles = profilesData.map(profile => ({
        ...profile,
        roles: rolesData.filter(r => r.user_id === profile.id).map(r => r.role),
      }));

      setUsers(usersWithRoles);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to fetch users',
        variant: 'destructive',
      });
    } finally {
      setUsersLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role: newRole as any });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Role assigned successfully',
      });

      fetchUsers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to assign role',
        variant: 'destructive',
      });
    }
  };

  const handleRemoveRole = async (userId: string, role: string) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', role as any);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Role removed successfully',
      });

      fetchUsers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to remove role',
        variant: 'destructive',
      });
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

      fetchPendingRequests();
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

      fetchPendingRequests();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to reject request',
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

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">
          {userRole === 'admin' ? 'Admin Panel' : 'Librarian Panel'}
        </h1>

        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending">
              Pending Requests ({pendingRequests.length})
            </TabsTrigger>
            {userRole === 'admin' && (
              <TabsTrigger value="users">
                <UserCog className="h-4 w-4 mr-2" />
                User Management
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="pending" className="space-y-4 mt-6">
            {pendingRequests.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">No pending requests</p>
                </CardContent>
              </Card>
            ) : (
              pendingRequests.map((request) => (
                <Card key={request.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-xl mb-2">{request.books.title}</CardTitle>
                        <p className="text-sm text-muted-foreground">by {request.books.author}</p>
                        <p className="text-sm text-muted-foreground mt-2">
                          Requested by: <span className="font-medium">{request.profiles.full_name}</span>
                        </p>
                      </div>
                      <Badge variant="secondary">Pending</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-sm">
                      <p className="text-muted-foreground">Request Date</p>
                      <p className="font-medium">{format(new Date(request.request_date), 'MMM dd, yyyy HH:mm')}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleApprove(request.id, request.book_id, request.books.max_borrow_days)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Approve
                      </Button>
                      <Button
                        onClick={() => handleReject(request.id)}
                        variant="destructive"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Reject
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {userRole === 'admin' && (
            <TabsContent value="users" className="space-y-4 mt-6">
              {usersLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                </div>
              ) : users.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">No users found</p>
                  </CardContent>
                </Card>
              ) : (
                users.map((userItem) => (
                  <Card key={userItem.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-xl mb-2">{userItem.full_name}</CardTitle>
                          <p className="text-sm text-muted-foreground">{userItem.email}</p>
                          {userItem.student_id && (
                            <p className="text-sm text-muted-foreground mt-1">
                              Student ID: {userItem.student_id}
                            </p>
                          )}
                        </div>
                        <Shield className="h-5 w-5 text-primary" />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <p className="text-sm font-medium mb-2">Current Roles:</p>
                        <div className="flex flex-wrap gap-2">
                          {userItem.roles.length > 0 ? (
                            userItem.roles.map((role: string) => (
                              <Badge key={role} variant="secondary" className="gap-2">
                                {role}
                                <button
                                  onClick={() => handleRemoveRole(userItem.id, role)}
                                  className="ml-1 hover:text-destructive"
                                >
                                  ×
                                </button>
                              </Badge>
                            ))
                          ) : (
                            <span className="text-sm text-muted-foreground">No roles assigned</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Select onValueChange={(value) => handleRoleChange(userItem.id, value)}>
                          <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Add role..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="student">Student</SelectItem>
                            <SelectItem value="librarian">Librarian</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
};

export default Admin;
