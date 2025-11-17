import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileSpreadsheet, CheckCircle, XCircle, Loader2, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import Papa from 'papaparse';
import { z } from 'zod';

const bookSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(255),
  author: z.string().trim().min(1, 'Author is required').max(255),
  publisher: z.string().trim().min(1, 'Publisher is required').max(255),
  isbn: z.string().trim().optional(),
  publication_year: z.coerce.number().int().min(1000).max(new Date().getFullYear() + 1).optional(),
  type: z.enum(['book', 'magazine', 'journal', 'research_paper', 'thesis']).default('book'),
  access_type: z.enum(['physical_only', 'online_only', 'both']).default('physical_only'),
  total_copies: z.coerce.number().int().min(1).default(1),
  available_copies: z.coerce.number().int().min(0).default(1),
  description: z.string().trim().max(2000).optional(),
  language: z.string().trim().max(50).default('English'),
  edition: z.string().trim().max(50).optional(),
  pages: z.coerce.number().int().min(1).optional(),
  topics: z.string().transform(val => val ? val.split(';').map(t => t.trim()).filter(Boolean) : []).optional(),
  tags: z.string().transform(val => val ? val.split(';').map(t => t.trim()).filter(Boolean) : []).optional(),
  pdf_url: z.string().url().optional().or(z.literal('')),
  cover_image_url: z.string().url().optional().or(z.literal('')),
  requires_approval: z.coerce.boolean().default(false),
  max_borrow_days: z.coerce.number().int().min(1).max(365).default(14),
});

type BookRecord = z.infer<typeof bookSchema>;

export const CsvUpload = () => {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<{
    success: number;
    failed: number;
    errors: string[];
  } | null>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast({
        title: 'Invalid File',
        description: 'Please upload a CSV file',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    setResults(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (parseResult) => {
        const errors: string[] = [];
        const validBooks: any[] = [];

        // Validate each row
        parseResult.data.forEach((row: any, index: number) => {
          try {
            const validatedBook = bookSchema.parse(row);
            validBooks.push(validatedBook);
          } catch (error: any) {
            if (error instanceof z.ZodError) {
              const rowErrors = error.errors.map(e => `Row ${index + 2}: ${e.path.join('.')} - ${e.message}`);
              errors.push(...rowErrors);
            } else {
              errors.push(`Row ${index + 2}: Unknown validation error`);
            }
          }
        });

        // Insert valid books
        let successCount = 0;
        if (validBooks.length > 0) {
          try {
            const { data, error } = await supabase
              .from('books')
              .insert(validBooks)
              .select();

            if (error) throw error;
            successCount = data?.length || 0;
          } catch (error: any) {
            errors.push(`Database error: ${error.message}`);
          }
        }

        setResults({
          success: successCount,
          failed: errors.length,
          errors: errors.slice(0, 10), // Show first 10 errors
        });

        if (successCount > 0) {
          toast({
            title: 'Upload Complete',
            description: `Successfully imported ${successCount} book(s)`,
          });
        }

        setUploading(false);
      },
      error: (error) => {
        toast({
          title: 'Parse Error',
          description: error.message,
          variant: 'destructive',
        });
        setUploading(false);
      },
    });

    // Reset input
    event.target.value = '';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          CSV Bulk Upload
        </CardTitle>
        <CardDescription>
          Upload a CSV file to add multiple books to the catalog at once
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-semibold">Required CSV Fields:</p>
              <ul className="list-disc list-inside text-sm space-y-1">
                <li><strong>title</strong> - Book title (required, max 255 characters)</li>
                <li><strong>author</strong> - Author name (required, max 255 characters)</li>
                <li><strong>publisher</strong> - Publisher name (required, max 255 characters)</li>
              </ul>
              <p className="font-semibold mt-3">Optional Fields:</p>
              <ul className="list-disc list-inside text-sm space-y-1">
                <li><strong>isbn</strong> - ISBN number</li>
                <li><strong>publication_year</strong> - Year (1000-{new Date().getFullYear() + 1})</li>
                <li><strong>type</strong> - book, magazine, journal, research_paper, or thesis (default: book)</li>
                <li><strong>access_type</strong> - physical_only, online_only, or both (default: physical_only)</li>
                <li><strong>total_copies</strong> - Number of copies (default: 1)</li>
                <li><strong>available_copies</strong> - Available copies (default: 1)</li>
                <li><strong>description</strong> - Book description (max 2000 characters)</li>
                <li><strong>language</strong> - Language (default: English)</li>
                <li><strong>edition</strong> - Edition information</li>
                <li><strong>pages</strong> - Number of pages</li>
                <li><strong>topics</strong> - Semicolon-separated topics (e.g., "Science;Physics;Quantum")</li>
                <li><strong>tags</strong> - Semicolon-separated tags (e.g., "bestseller;award-winning")</li>
                <li><strong>pdf_url</strong> - URL to PDF file</li>
                <li><strong>cover_image_url</strong> - URL to cover image</li>
                <li><strong>requires_approval</strong> - true or false (default: false)</li>
                <li><strong>max_borrow_days</strong> - Max days (1-365, default: 14)</li>
              </ul>
            </div>
          </AlertDescription>
        </Alert>

        <div className="flex items-center gap-4">
          <Input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            disabled={uploading}
            className="cursor-pointer"
          />
          {uploading && (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          )}
        </div>

        {results && (
          <div className="space-y-3">
            {results.success > 0 && (
              <Alert className="border-green-500">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <AlertDescription>
                  Successfully imported {results.success} book(s)
                </AlertDescription>
              </Alert>
            )}
            
            {results.failed > 0 && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-semibold mb-2">{results.failed} error(s) found:</p>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    {results.errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                    {results.failed > 10 && (
                      <li className="italic">...and {results.failed - 10} more errors</li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <div className="pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const csvContent = [
                'title,author,publisher,isbn,publication_year,type,access_type,total_copies,available_copies,description,language,edition,pages,topics,tags,pdf_url,cover_image_url,requires_approval,max_borrow_days',
                'Sample Book Title,John Doe,Sample Publisher,978-1234567890,2024,book,physical_only,5,5,A great book about sample topics,English,1st Edition,300,Technology;Programming,bestseller;new,,,false,14',
              ].join('\n');
              
              const blob = new Blob([csvContent], { type: 'text/csv' });
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'book_template.csv';
              a.click();
              window.URL.revokeObjectURL(url);
            }}
          >
            <Upload className="h-4 w-4 mr-2" />
            Download CSV Template
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
