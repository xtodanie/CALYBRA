import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, List } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-headline text-3xl font-bold tracking-tight">Dashboard</h1>
        <Button>
          <PlusCircle className="mr-2" />
          Create Month Close
        </Button>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <List />
            Month Closes
          </CardTitle>
          <CardDescription>
            Here are the ongoing and past reconciliation periods for your organization.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-64 items-center justify-center rounded-lg border-2 border-dashed border-border text-center">
            <div className="space-y-2">
              <p className="text-muted-foreground">No month closes created yet.</p>
              <Button variant="secondary">
                <PlusCircle className="mr-2" />
                Create Your First Month Close
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
