import { Link } from 'react-router-dom';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BookOpen, Eye, MapPin, FileText } from 'lucide-react';

interface Book {
  id: string;
  title: string;
  author: string;
  publisher: string;
  type: string;
  access_type: string;
  available_copies: number;
  total_copies: number;
  tags: string[];
  topics: string[];
  cover_image_url?: string;
}

interface BookCardProps {
  book: Book;
}

export function BookCard({ book }: BookCardProps) {
  const isAvailable = book.available_copies > 0;
  const hasOnlineAccess = book.access_type === 'online_only' || book.access_type === 'both';

  return (
    <Card className="group hover:shadow-lg transition-shadow duration-300">
      <CardHeader className="p-0">
        <div className="h-48 bg-gradient-to-br from-primary-light to-primary rounded-t-lg flex items-center justify-center relative overflow-hidden">
          {book.cover_image_url ? (
            <img src={book.cover_image_url} alt={book.title} className="h-full w-full object-cover" />
          ) : (
            <BookOpen className="h-20 w-20 text-white opacity-50" />
          )}
          <div className="absolute top-3 right-3 flex gap-2">
            {hasOnlineAccess && (
              <Badge className="bg-accent text-white">
                <Eye className="h-3 w-3 mr-1" />
                Online
              </Badge>
            )}
            {book.access_type === 'physical_only' && (
              <Badge variant="secondary">
                <MapPin className="h-3 w-3 mr-1" />
                Physical
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-4 space-y-3">
        <div>
          <h3 className="font-semibold text-lg line-clamp-2 group-hover:text-primary transition">
            {book.title}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">{book.author}</p>
          <p className="text-xs text-muted-foreground">{book.publisher}</p>
        </div>

        <div className="flex flex-wrap gap-1">
          <Badge variant="outline" className="text-xs">
            <FileText className="h-3 w-3 mr-1" />
            {book.type.replace('_', ' ')}
          </Badge>
          {book.topics.slice(0, 2).map((topic, i) => (
            <Badge key={i} variant="secondary" className="text-xs">
              {topic}
            </Badge>
          ))}
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Availability:</span>
          <span className={isAvailable ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
            {book.available_copies} of {book.total_copies}
          </span>
        </div>
      </CardContent>

      <CardFooter className="p-4 pt-0">
        <Link to={`/book/${book.id}`} className="w-full">
          <Button className="w-full" variant={isAvailable ? 'default' : 'secondary'}>
            View Details
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
