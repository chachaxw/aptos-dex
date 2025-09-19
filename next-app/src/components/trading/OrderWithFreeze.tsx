'use client';

import React, { useState } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, CheckCircle, AlertCircle, Lock, Unlock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';

interface OrderWithFreezeProps {
  marketId: number;
  onOrderSubmitted?: (orderId: string, txHash: string) => void;
  className?: string;
}

interface FreezeTransactionPayload {
  function: string;
  type_arguments: string[];
  arguments: string[];
  gas_limit: number;
  gas_unit_price: number;
}

interface FreezeTransactionResponse {
  order_id: string;
  freeze_transaction_payload: FreezeTransactionPayload;
  required_collateral: number;
  message: string;
}

export function OrderWithFreeze({ marketId, onOrderSubmitted, className }: OrderWithFreezeProps) {
  const { account, signAndSubmitTransaction } = useWallet();
  const { toast } = useToast();
  
  const [orderData, setOrderData] = useState({
    side: 'Buy' as 'Buy' | 'Sell',
    orderType: 'Limit' as 'Limit' | 'Market',
    size: '',
    price: '',
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [freezeResponse, setFreezeResponse] = useState<FreezeTransactionResponse | null>(null);
  const [step, setStep] = useState<'input' | 'freeze' | 'confirm'>('input');

  const handleInputChange = (field: string, value: string) => {
    setOrderData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleRequestFreeze = async () => {
    if (!account?.address) {
      setError('Please connect your wallet');
      return;
    }

    if (!orderData.size || (orderData.orderType === 'Limit' && !orderData.price)) {
      setError('Please fill in all required fields');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const request = {
        user_address: account.address.toString(),
        market_id: marketId,
        side: orderData.side,
        order_type: orderData.orderType,
        size: orderData.size,
        price: orderData.orderType === 'Limit' ? orderData.price : null,
        expires_at: null,
      };

      const response = await fetch('http://localhost:8080/orders/freeze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to request freeze transaction: ${response.status} ${errorText}`);
      }

      const freezeData: FreezeTransactionResponse = await response.json();
      setFreezeResponse(freezeData);
      setStep('freeze');
      
      toast({
        title: "Freeze Transaction Ready",
        description: `Please sign the transaction to freeze ${freezeData.required_collateral} USDC`,
      });

    } catch (err: any) {
      console.error('Freeze request failed:', err);
      setError(err.message || 'Failed to request freeze transaction');
      toast({
        title: "Freeze Request Failed",
        description: err.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignFreeze = async () => {
    if (!freezeResponse || !account) return;

    setIsLoading(true);
    setError(null);

    try {
      // Convert the freeze transaction payload to the format expected by the wallet
      const payload = {
        type: "entry_function_payload",
        function: freezeResponse.freeze_transaction_payload.function as `${string}::${string}::${string}`,
        typeArguments: freezeResponse.freeze_transaction_payload.type_arguments,
        functionArguments: freezeResponse.freeze_transaction_payload.arguments,
      };

      // Sign and submit the transaction
      const response = await signAndSubmitTransaction({
        sender: account.address,
        data: payload,
      });

      setStep('confirm');
      
      toast({
        title: "Freeze Transaction Signed",
        description: `Transaction confirmed: ${response.hash.slice(0, 6)}...${response.hash.slice(-4)}`,
      });

      // Now confirm the order
      await handleConfirmOrder(response.hash);

    } catch (err: any) {
      console.error('Freeze signing failed:', err);
      setError(err.message || 'Failed to sign freeze transaction');
      toast({
        title: "Freeze Signing Failed",
        description: err.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmOrder = async (txHash: string) => {
    if (!freezeResponse) return;

    try {
      const confirmRequest = {
        order_id: freezeResponse.order_id,
        signed_transaction_hash: txHash,
      };

      const response = await fetch('http://localhost:8080/orders/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(confirmRequest),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to confirm order: ${response.status} ${errorText}`);
      }

      const confirmData = await response.json();
      
      toast({
        title: "Order Submitted Successfully!",
        description: `Order ID: ${confirmData.order.id}`,
      });

      onOrderSubmitted?.(confirmData.order.id, txHash);
      
      // Reset form
      setOrderData({ side: 'Buy', orderType: 'Limit', size: '', price: '' });
      setFreezeResponse(null);
      setStep('input');

    } catch (err: any) {
      console.error('Order confirmation failed:', err);
      setError(err.message || 'Failed to confirm order');
      toast({
        title: "Order Confirmation Failed",
        description: err.message || "An unexpected error occurred",
        variant: "destructive",
      });
    }
  };

  const handleReset = () => {
    setOrderData({ side: 'Buy', orderType: 'Limit', size: '', price: '' });
    setFreezeResponse(null);
    setStep('input');
    setError(null);
  };

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          {step === 'input' && <Unlock className="w-5 h-5" />}
          {step === 'freeze' && <Lock className="w-5 h-5" />}
          {step === 'confirm' && <CheckCircle className="w-5 h-5" />}
          <span className="text-base">
            {step === 'input' && 'Create Order (User-Signed Freeze)'}
            {step === 'freeze' && 'Sign Freeze Transaction'}
            {step === 'confirm' && 'Order Confirmed'}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!account?.address ? (
          <div className="text-center py-4 text-gray-500">
            <p>Connect your wallet to place orders</p>
          </div>
        ) : (
          <>
            {step === 'input' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="side">Side</Label>
                    <Select value={orderData.side} onValueChange={(value: 'Buy' | 'Sell') => handleInputChange('side', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Buy">Buy</SelectItem>
                        <SelectItem value="Sell">Sell</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="orderType">Type</Label>
                    <Select value={orderData.orderType} onValueChange={(value: 'Limit' | 'Market') => handleInputChange('orderType', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Limit">Limit</SelectItem>
                        <SelectItem value="Market">Market</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="size">Size</Label>
                  <Input
                    id="size"
                    type="number"
                    placeholder="e.g., 0.1"
                    value={orderData.size}
                    min={0}
                    max={1000000}
                    onChange={(e) => handleInputChange('size', e.target.value)}
                  />
                </div>

                {orderData.orderType === 'Limit' && (
                  <div className="space-y-2">
                    <Label htmlFor="price">Price</Label>
                    <Input
                      id="price"
                      type="number"
                      placeholder="e.g., 40000"
                      value={orderData.price}
                      onChange={(e) => handleInputChange('price', e.target.value)}
                    />
                  </div>
                )}

                {error && (
                  <div className="flex items-center space-x-2 text-red-600 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    <span>{error}</span>
                  </div>
                )}

                <Button
                  onClick={handleRequestFreeze}
                  disabled={isLoading || !orderData.size || (orderData.orderType === 'Limit' && !orderData.price)}
                  className="w-full"
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Unlock className="mr-2 h-4 w-4" />
                  )}
                  {isLoading ? 'Requesting Freeze...' : 'Request Freeze Transaction'}
                </Button>
              </>
            )}

            {step === 'freeze' && freezeResponse && (
              <>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="font-medium text-blue-900 mb-2">Freeze Transaction Required</h3>
                  <p className="text-sm text-blue-700 mb-3">
                    {freezeResponse.message}
                  </p>
                  <div className="text-sm text-blue-600">
                    <p><strong>Required Collateral:</strong> {freezeResponse.required_collateral} USDC</p>
                    <p><strong>Order ID:</strong> {freezeResponse.order_id}</p>
                  </div>
                </div>

                {error && (
                  <div className="flex items-center space-x-2 text-red-600 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="flex space-x-2">
                  <Button
                    onClick={handleSignFreeze}
                    disabled={isLoading}
                    className="flex-1"
                  >
                    {isLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Lock className="mr-2 h-4 w-4" />
                    )}
                    {isLoading ? 'Signing...' : 'Sign Freeze Transaction'}
                  </Button>
                  <Button
                    onClick={handleReset}
                    variant="outline"
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                </div>
              </>
            )}

            {step === 'confirm' && (
              <>
                <div className="bg-green-50 p-4 rounded-lg text-center">
                  <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <h3 className="font-medium text-green-900 mb-1">Order Confirmed!</h3>
                  <p className="text-sm text-green-700">
                    Your order has been submitted successfully.
                  </p>
                </div>

                <Button
                  onClick={handleReset}
                  className="w-full"
                >
                  Place Another Order
                </Button>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
