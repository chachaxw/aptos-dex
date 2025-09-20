"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, TrendingUp, TrendingDown } from "lucide-react";
import { MatchingEngineClient } from "@/lib/matching-engine-client";
import { useToast } from "@/components/ui/use-toast";
import { FreezeTransactionResponse } from "@/lib/type/order";

interface CreateOrderProps {
  marketId?: number;
  defaultSide?: "Buy" | "Sell";
  defaultPrice?: string;
  onOrderSubmitted?: (orderId: string, txHash: string) => void;
}

const MARKETS = {
  1: { symbol: "BTC-USDC", tickSize: 0.01, lotSize: 0.001, maxLeverage: 20 },
  2: { symbol: "ETH-USDC", tickSize: 0.01, lotSize: 0.01, maxLeverage: 15 },
  3: { symbol: "SOL-USDC", tickSize: 0.01, lotSize: 0.1, maxLeverage: 10 },
};

export function CreateOrder({
  marketId = 1,
  defaultSide = "Buy",
  defaultPrice,
  onOrderSubmitted,
}: CreateOrderProps) {
  const { account, connected, signAndSubmitTransaction } = useWallet();
  const { toast } = useToast();
  const [matchingEngine] = useState(() => new MatchingEngineClient());

  // Form state
  const [orderData, setOrderData] = useState({
    side: defaultSide,
    orderType: "Limit" as "Market" | "Limit",
    size: "",
    price: defaultPrice || "",
    reduceOnly: false,
    postOnly: false,
    timeInForce: "GTC" as "GTC" | "IOC" | "FOK",
  });

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEngineHealthy, setIsEngineHealthy] = useState(false);
  const [estimatedCost, setEstimatedCost] = useState<number>(0);
  const [maxBuyPower, setMaxBuyPower] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [freezeResponse, setFreezeResponse] =
    useState<FreezeTransactionResponse | null>(null);

  const market = MARKETS[marketId as keyof typeof MARKETS];

  // Check matching engine health
  useEffect(() => {
    const checkHealth = async () => {
      const healthy = await matchingEngine.isHealthy();
      setIsEngineHealthy(healthy);
    };

    checkHealth();
    const interval = setInterval(checkHealth, 10000); // Check every 10s
    return () => clearInterval(interval);
  }, [matchingEngine]);

  // Calculate estimated cost and buying power
  useEffect(() => {
    if (orderData.size && orderData.price && orderData.side === "Buy") {
      const cost = parseFloat(orderData.size) * parseFloat(orderData.price);
      setEstimatedCost(cost);

      // Mock buying power calculation (would integrate with account balance)
      setMaxBuyPower(10000); // $10k mock balance
    } else {
      setEstimatedCost(0);
    }
  }, [orderData.size, orderData.price, orderData.side]);

  const handleConfirmOrder = useCallback(
    async (txHash: string) => {

      console.log(freezeResponse);

      if (!freezeResponse) return;

      try {
        const confirmRequest = {
          market_id: marketId,
          order_type: orderData.orderType,
          size: orderData.size,
          price: orderData.price,
          side: orderData.side,
          expires_at: null,
          user_address: account?.address.toString() || "",
          order_id: freezeResponse.order_id,
          signed_transaction_hash: txHash,
        };

        const response = await fetch("http://localhost:8080/orders/confirm", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(confirmRequest),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Failed to confirm order: ${response.status} ${errorText}`
          );
        }

        const confirmData = await response.json();

        toast({
          title: "Order Submitted Successfully!",
          description: `Order ID: ${confirmData.order.id}`,
        });

        onOrderSubmitted?.(confirmData.order.id, txHash);

        // Reset form
        setOrderData({
          side: "Buy",
          orderType: "Limit",
          size: "",
          price: "",
          reduceOnly: false,
          postOnly: false,
          timeInForce: "GTC",
        });

        setFreezeResponse(null);
      } catch (err: any) {
        console.error("Order confirmation failed:", err);
        setError(err.message || "Failed to confirm order");
        toast({
          title: "Order Confirmation Failed",
          description: err.message || "An unexpected error occurred",
          variant: "destructive",
        });
      }
    },
    [account?.address, freezeResponse, marketId, onOrderSubmitted, orderData.orderType, orderData.price, orderData.side, orderData.size, toast]
  );

  console.log('返回参数:', freezeResponse);

  const handleSignOrder = useCallback(
    async (freezeResponse: FreezeTransactionResponse) => {
      if (!account) return;

      setIsSubmitting(true);
      setError(null);

      try {
        // Convert the freeze transaction payload to the format expected by the wallet
        const payload = {
          type: "entry_function_payload",
          function: freezeResponse.freeze_transaction_payload
            .function as `${string}::${string}::${string}`,
          typeArguments:
            freezeResponse.freeze_transaction_payload.type_arguments,
          functionArguments:
            freezeResponse.freeze_transaction_payload.arguments,
        };

        // Sign and submit the transaction
        const response = await signAndSubmitTransaction({
          sender: account.address,
          data: payload,
        });

        toast({
          title: "Freeze Transaction Signed",
          description: `Transaction confirmed: ${response.hash.slice(
            0,
            6
          )}...${response.hash.slice(-4)}`,
        });

        await handleConfirmOrder(response.hash);
      } catch (err: any) {
        console.error("Freeze signing failed:", err);
        setError(err.message || "Failed to sign freeze transaction");
        toast({
          title: "Freeze Signing Failed",
          description: err.message || "An unexpected error occurred",
          variant: "destructive",
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [account, signAndSubmitTransaction, toast, handleConfirmOrder]
  );

  const handleRequestOrder = useCallback(async () => {
    if (!account?.address) {
      setError("Please connect your wallet");
      return;
    }

    if (
      !orderData.size ||
      (orderData.orderType === "Limit" && !orderData.price)
    ) {
      setError("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const request = {
        user_address: account.address.toString(),
        market_id: marketId,
        side: orderData.side,
        order_type: orderData.orderType,
        size: orderData.size,
        price: orderData.orderType === "Limit" ? orderData.price : null,
        expires_at: null,
      };

      const response = await fetch("http://localhost:8080/orders/freeze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to request freeze transaction: ${response.status} ${errorText}`
        );
      }

      const freezeData: FreezeTransactionResponse = await response.json();

      setFreezeResponse(freezeData);
      handleSignOrder(freezeData);

      toast({
        title: "Freeze Transaction Ready",
        description: `Please sign the transaction to freeze ${freezeData.required_collateral} USDC`,
      });
    } catch (err: any) {
      console.error("Freeze request failed:", err);
      setError(err.message || "Failed to request freeze transaction");
      toast({
        title: "Freeze Request Failed",
        description: err.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    account?.address,
    handleSignOrder,
    marketId,
    orderData.orderType,
    orderData.price,
    orderData.side,
    orderData.size,
    toast,
  ]);

  const handleMaxSize = () => {
    if (orderData.side === "Buy" && orderData.price) {
      const maxSize = maxBuyPower / parseFloat(orderData.price);
      setOrderData({ ...orderData, size: maxSize.toFixed(3) });
    } else if (orderData.side === "Sell") {
      // Would integrate with position size from contracts
      const maxPosition = 10; // Mock position size
      setOrderData({ ...orderData, size: maxPosition.toString() });
    }
  };

  const sideBg =
    orderData.side === "Buy"
      ? "bg-green-50 border-green-200"
      : "bg-red-50 border-red-200";

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-lg">Create Order</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Side Selection */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={orderData.side === "Buy" ? "default" : "outline"}
            onClick={() => setOrderData({ ...orderData, side: "Buy" })}
            className={
              orderData.side === "Buy" ? "bg-green-600 hover:bg-green-700" : ""
            }
          >
            <TrendingUp className="w-4 h-4 mr-1" />
            Buy
          </Button>
          <Button
            variant={orderData.side === "Sell" ? "default" : "outline"}
            onClick={() => setOrderData({ ...orderData, side: "Sell" })}
            className={
              orderData.side === "Sell" ? "bg-red-600 hover:bg-red-700" : ""
            }
          >
            <TrendingDown className="w-4 h-4 mr-1" />
            Sell
          </Button>
        </div>

        {/* Order Type */}
        <div className="space-y-2">
          <Label>Order Type</Label>
          <Select
            value={orderData.orderType}
            onValueChange={(value: "Market" | "Limit") =>
              setOrderData({
                ...orderData,
                orderType: value,
                price: value === "Market" ? "" : orderData.price,
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Limit">Limit Order</SelectItem>
              <SelectItem value="Market">Market Order</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Size Input */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label>Size ({market.symbol.split("-")[0]})</Label>
            <Button
              variant="link"
              size="sm"
              onClick={handleMaxSize}
              className="h-auto p-0 text-xs"
            >
              Max
            </Button>
          </div>
          <Input
            type="number"
            step={market.lotSize}
            value={orderData.size}
            onChange={(e) =>
              setOrderData({ ...orderData, size: e.target.value })
            }
            placeholder={`Min: ${market.lotSize}`}
            className={sideBg}
          />
        </div>

        {/* Price Input (for limit orders) */}
        {orderData.orderType === "Limit" && (
          <div className="space-y-2">
            <Label>Price (USD)</Label>
            <Input
              type="number"
              step={market.tickSize}
              value={orderData.price}
              onChange={(e) =>
                setOrderData({ ...orderData, price: e.target.value })
              }
              placeholder={`Tick: ${market.tickSize}`}
              className={sideBg}
            />
          </div>
        )}

        {/* Advanced Options */}
        <div className="space-y-3 pt-2 border-t">
          <div className="flex items-center justify-between">
            <Label htmlFor="reduce-only" className="text-sm">
              Reduce Only
            </Label>
            <Switch
              id="reduce-only"
              checked={orderData.reduceOnly}
              onCheckedChange={(checked) =>
                setOrderData({ ...orderData, reduceOnly: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="post-only" className="text-sm">
              Post Only
            </Label>
            <Switch
              id="post-only"
              checked={orderData.postOnly}
              onCheckedChange={(checked) =>
                setOrderData({ ...orderData, postOnly: checked })
              }
              disabled={orderData.orderType === "Market"}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Time in Force</Label>
            <Select
              value={orderData.timeInForce}
              onValueChange={(value: "GTC" | "IOC" | "FOK") =>
                setOrderData({ ...orderData, timeInForce: value })
              }
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GTC">Good Till Cancelled</SelectItem>
                <SelectItem value="IOC">Immediate or Cancel</SelectItem>
                <SelectItem value="FOK">Fill or Kill</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Order Summary */}
        {orderData.size &&
          orderData.orderType === "Limit" &&
          orderData.price && (
            <div className={`p-3 rounded-lg border ${sideBg}`}>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Order Value:</span>
                  <span className="font-medium">
                    ${estimatedCost.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Est. Fee (0.1%):</span>
                  <span>${(estimatedCost * 0.001).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Cost:</span>
                  <span className="font-bold">
                    ${(estimatedCost * 1.001).toFixed(2)}
                  </span>
                </div>
                {orderData.side === "Buy" && (
                  <div className="flex justify-between text-xs">
                    <span>Available:</span>
                    <span>${maxBuyPower.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

        {/* Submit Button */}
        <Button
          onClick={handleRequestOrder}
          disabled={
            !connected || isSubmitting || !orderData.size || !isEngineHealthy
          }
          className={`w-full ${
            orderData.side === "Buy"
              ? "bg-green-600 hover:bg-green-700"
              : "bg-red-600 hover:bg-red-700"
          }`}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              {orderData.side === "Buy" ? (
                <TrendingUp className="w-4 h-4 mr-2" />
              ) : (
                <TrendingDown className="w-4 h-4 mr-2" />
              )}
              {orderData.side.toUpperCase()}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
