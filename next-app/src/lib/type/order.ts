export interface FreezeTransactionPayload {
    function: string;
    type_arguments: string[];
    arguments: string[];
    gas_limit: number;
    gas_unit_price: number;
  }
  
export interface FreezeTransactionResponse {
    order_id: string;
    freeze_transaction_payload: FreezeTransactionPayload;
    required_collateral: number;
    message: string;
  }