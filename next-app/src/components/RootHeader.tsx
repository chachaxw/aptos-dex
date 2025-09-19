"use client";

import { ThemeToggle } from "@/components/ThemeToggle";
import { WalletSelector } from "@/components/wallet/WalletSelector";
import { MatchingEngineClient } from "@/lib/matching-engine-client";
import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "./ui/alert";
import { AlertCircle } from "lucide-react";
import { Badge } from "./ui/badge";

export const RootHeader = () => {
  const [matchingEngine] = useState(() => new MatchingEngineClient());
  const [isEngineOnline, setIsEngineOnline] = useState(false);

  // Check matching engine status
  useEffect(() => {
    const checkEngineHealth = async () => {
      const healthy = await matchingEngine.isHealthy();
      setIsEngineOnline(healthy);
    };

    checkEngineHealth();
    const interval = setInterval(checkEngineHealth, 5000);
    return () => clearInterval(interval);
  }, [matchingEngine]);

  return (
    <header className="sticky top-0 z-50 glass-effect border-b">
      <div className="mx-auto px-6 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-8">
            <a href="/" className="group flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-chart-2 flex items-center justify-center shadow-lg">
                <svg
                  className="w-6 h-6 text-white"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gradient group-hover:scale-105 transition-transform">
                  Aptos HyperPerp
                </h1>
                <p className="text-xs text-muted-foreground">Demo</p>
              </div>
            </a>
          </div>

          <div className="flex items-center gap-3">
            {/* Engine Status */}
            {!isEngineOnline ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Matching engine is offline. Orders will queue until
                  reconnected.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full bg-green-500`} />
                <Badge variant="outline">Engine Online</Badge>
              </div>
            )}
            <WalletSelector />
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
};
