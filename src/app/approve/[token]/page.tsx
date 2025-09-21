'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import Image from 'next/image';

interface RenderAsset {
  id: string;
  asset: {
    id: string;
    url: string;
    title?: string;
  };
  includeInEmail: boolean;
}

interface ClientApprovalData {
  versionId: string;
  projectName: string;
  clientName: string;
  status: string;
  assets: RenderAsset[];
  sentAt: string;
}

export default function ClientApprovalPage() {
  const { token } = useParams();
  const [data, setData] = useState<ClientApprovalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [comments, setComments] = useState('');
  const [decision, setDecision] = useState<'APPROVED' | 'REVISION_REQUESTED' | null>(null);

  useEffect(() => {
    fetchApprovalData();
  }, [token]);

  const fetchApprovalData = async () => {
    try {
      const response = await fetch(`/api/client-approval/public/${token}`);
      if (!response.ok) {
        throw new Error('Invalid or expired approval link');
      }
      const result = await response.json();
      
      // Transform the API response to match expected ClientApprovalData format
      const transformedData: ClientApprovalData = {
        versionId: result.version.id,
        projectName: result.version.stage.room.project.name,
        clientName: result.clientInfo.name,
        status: result.version.status,
        assets: result.version.assets || [],
        sentAt: result.version.sentToClientAt
      };
      
      setData(transformedData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load approval data');
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async (newDecision: 'APPROVED' | 'REVISION_REQUESTED') => {
    if (!data) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/client-approval/decide`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          decision: newDecision,
          comments: comments.trim()
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit decision');
      }

      setDecision(newDecision);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit decision');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Clock className="mx-auto h-12 w-12 text-gray-400 animate-spin" />
          <p className="mt-4 text-gray-600">Loading your approval request...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center text-red-600">
              <AlertCircle className="mr-2 h-5 w-5" />
              Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-gray-600">No approval data found.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (decision) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center text-center">
              {decision === 'APPROVED' ? (
                <>
                  <CheckCircle className="mr-2 h-6 w-6 text-green-600" />
                  <span className="text-green-600">Approved!</span>
                </>
              ) : (
                <>
                  <XCircle className="mr-2 h-6 w-6 text-orange-600" />
                  <span className="text-orange-600">Revisions Requested</span>
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center text-gray-600 mb-4">
              Thank you for your feedback! We'll be in touch soon.
            </p>
            {comments && (
              <div className="bg-gray-100 rounded-lg p-3">
                <p className="text-sm font-medium text-gray-700 mb-1">Your comments:</p>
                <p className="text-sm text-gray-600">{comments}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const emailedAssets = data.assets ? data.assets.filter(asset => asset.includeInEmail) : [];

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Design Approval Request</h1>
          <p className="mt-2 text-lg text-gray-600">
            Hi {data.clientName}, please review the renderings for {data.projectName}
          </p>
          <div className="mt-4 flex justify-center">
            <Badge variant="outline" className="px-3 py-1">
              Sent: {new Date(data.sentAt).toLocaleDateString()}
            </Badge>
          </div>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Renderings for Review</CardTitle>
          </CardHeader>
          <CardContent>
            {emailedAssets.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No renderings to display.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {emailedAssets.map((asset) => (
                  <div key={asset.id} className="relative group">
                    <div className="aspect-video relative overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                      <Image
                        src={asset.asset.url}
                        alt={asset.asset.title || `Rendering ${asset.id}`}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Your Feedback</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label htmlFor="comments" className="block text-sm font-medium text-gray-700 mb-2">
                  Comments (optional)
                </label>
                <Textarea
                  id="comments"
                  placeholder="Please share any specific feedback, changes, or questions..."
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  rows={4}
                  className="w-full"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Button
                  onClick={() => handleDecision('APPROVED')}
                  disabled={submitting}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  size="lg"
                >
                  {submitting ? (
                    <Clock className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="mr-2 h-4 w-4" />
                  )}
                  Approve All Renderings
                </Button>
                <Button
                  onClick={() => handleDecision('REVISION_REQUESTED')}
                  disabled={submitting}
                  variant="outline"
                  className="flex-1 border-orange-300 text-orange-700 hover:bg-orange-50"
                  size="lg"
                >
                  {submitting ? (
                    <Clock className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="mr-2 h-4 w-4" />
                  )}
                  Request Revisions
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="text-center text-sm text-gray-500">
          <p>Need help? Contact us at support@residentone.com</p>
        </div>
      </div>
    </div>
  );
}