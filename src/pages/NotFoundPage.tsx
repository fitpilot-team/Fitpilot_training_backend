import { Link } from 'react-router-dom';
import { Button } from '../components/common/Button';

export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-9xl font-bold text-primary-600">404</h1>
        <h2 className="text-3xl font-bold text-gray-900 mt-4 mb-2">Page Not Found</h2>
        <p className="text-gray-600 mb-8">
          Sorry, we couldn't find the page you're looking for.
        </p>
        <Link to="/">
          <Button variant="primary">Go Back Home</Button>
        </Link>
      </div>
    </div>
  );
}
