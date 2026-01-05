/**
 * Payment Service
 *
 * Handles crypto payment processing for the Modchain platform.
 * Currently a stub implementation - will integrate with BTCPay Server or similar.
 */

import { v4 as uuidv4 } from 'uuid';

// ============ Types ============

export interface PaymentAccount {
  id: string;
  wallet_address: string;
  balance_cents: number;
  currency: string;
  created_at: Date;
}

export interface Payment {
  id: string;
  from_account: string;
  to_account: string;
  amount_cents: number;
  currency: string;
  job_id?: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  created_at: Date;
  completed_at?: Date;
}

export interface DepositRequest {
  account_id: string;
  amount_cents: number;
  currency: string;
  crypto_address?: string;
}

export interface WithdrawRequest {
  account_id: string;
  amount_cents: number;
  currency: string;
  destination_address: string;
}

// ============ Payment Service ============

export class PaymentService {
  private accounts: Map<string, PaymentAccount> = new Map();
  private payments: Map<string, Payment> = new Map();
  private pendingDeposits: Map<string, DepositRequest> = new Map();

  // System account for collecting fees
  private readonly systemAccountId = 'system';
  private readonly feePercentage = 5; // 5% platform fee

  constructor() {
    // Create system account
    this.accounts.set(this.systemAccountId, {
      id: this.systemAccountId,
      wallet_address: 'system',
      balance_cents: 0,
      currency: 'USDC',
      created_at: new Date(),
    });

    console.log('[PaymentService] Initialized (STUB MODE - no real payments)');
  }

  /**
   * Create or get an account for a wallet address
   */
  getOrCreateAccount(walletAddress: string, currency: string = 'USDC'): PaymentAccount {
    // Check if account exists
    for (const account of this.accounts.values()) {
      if (account.wallet_address === walletAddress) {
        return account;
      }
    }

    // Create new account
    const account: PaymentAccount = {
      id: uuidv4(),
      wallet_address: walletAddress,
      balance_cents: 0,
      currency,
      created_at: new Date(),
    };

    this.accounts.set(account.id, account);
    console.log(`[PaymentService] Created account ${account.id} for ${walletAddress}`);

    return account;
  }

  /**
   * Get account by ID
   */
  getAccount(accountId: string): PaymentAccount | undefined {
    return this.accounts.get(accountId);
  }

  /**
   * Get account balance
   */
  getBalance(accountId: string): number {
    const account = this.accounts.get(accountId);
    return account?.balance_cents || 0;
  }

  /**
   * Request a deposit (generates crypto address for payment)
   * In production, this would create an invoice with BTCPay Server
   */
  async requestDeposit(accountId: string, amountCents: number, currency: string = 'USDC'): Promise<{
    deposit_id: string;
    address: string;
    amount: number;
    currency: string;
    expires_at: Date;
  }> {
    const account = this.accounts.get(accountId);
    if (!account) {
      throw new Error('Account not found');
    }

    const depositId = uuidv4();

    // In production, this would be a real crypto address from BTCPay Server
    const mockAddress = `0x${depositId.replace(/-/g, '').slice(0, 40)}`;

    this.pendingDeposits.set(depositId, {
      account_id: accountId,
      amount_cents: amountCents,
      currency,
      crypto_address: mockAddress,
    });

    console.log(`[PaymentService] STUB: Deposit request ${depositId} for ${amountCents} cents`);

    return {
      deposit_id: depositId,
      address: mockAddress,
      amount: amountCents / 100,
      currency,
      expires_at: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
    };
  }

  /**
   * Confirm a deposit (called by webhook or manual verification)
   * In production, this would be triggered by BTCPay Server webhook
   */
  async confirmDeposit(depositId: string): Promise<boolean> {
    const deposit = this.pendingDeposits.get(depositId);
    if (!deposit) {
      return false;
    }

    const account = this.accounts.get(deposit.account_id);
    if (!account) {
      return false;
    }

    // Credit the account
    account.balance_cents += deposit.amount_cents;
    this.pendingDeposits.delete(depositId);

    console.log(`[PaymentService] STUB: Deposit ${depositId} confirmed, credited ${deposit.amount_cents} cents`);

    return true;
  }

  /**
   * Add test credits to an account (for development/testing)
   */
  addTestCredits(accountId: string, amountCents: number): boolean {
    const account = this.accounts.get(accountId);
    if (!account) {
      return false;
    }

    account.balance_cents += amountCents;
    console.log(`[PaymentService] Added ${amountCents} test cents to account ${accountId}`);

    return true;
  }

  /**
   * Check if account has sufficient balance for a job
   */
  canAfford(accountId: string, amountCents: number): boolean {
    const balance = this.getBalance(accountId);
    return balance >= amountCents;
  }

  /**
   * Hold funds for a job (escrow)
   * Returns hold ID if successful
   */
  async holdFunds(accountId: string, amountCents: number, jobId: string): Promise<string | null> {
    const account = this.accounts.get(accountId);
    if (!account || account.balance_cents < amountCents) {
      return null;
    }

    // Deduct from balance (held in escrow)
    account.balance_cents -= amountCents;

    // Create pending payment
    const payment: Payment = {
      id: uuidv4(),
      from_account: accountId,
      to_account: '', // Will be set when job completes
      amount_cents: amountCents,
      currency: account.currency,
      job_id: jobId,
      status: 'pending',
      created_at: new Date(),
    };

    this.payments.set(payment.id, payment);

    console.log(`[PaymentService] Held ${amountCents} cents for job ${jobId}`);

    return payment.id;
  }

  /**
   * Complete a payment (release escrow to node operator)
   */
  async completePayment(paymentId: string, nodeAccountId: string, actualCostCents: number): Promise<boolean> {
    const payment = this.payments.get(paymentId);
    if (!payment || payment.status !== 'pending') {
      return false;
    }

    const nodeAccount = this.accounts.get(nodeAccountId);
    if (!nodeAccount) {
      return false;
    }

    // Calculate fee
    const feeCents = Math.round(actualCostCents * (this.feePercentage / 100));
    const nodePayout = actualCostCents - feeCents;

    // Pay the node
    nodeAccount.balance_cents += nodePayout;

    // Pay the platform
    const systemAccount = this.accounts.get(this.systemAccountId)!;
    systemAccount.balance_cents += feeCents;

    // Refund difference if job cost less than held
    if (payment.amount_cents > actualCostCents) {
      const refund = payment.amount_cents - actualCostCents;
      const clientAccount = this.accounts.get(payment.from_account);
      if (clientAccount) {
        clientAccount.balance_cents += refund;
      }
    }

    // Update payment record
    payment.to_account = nodeAccountId;
    payment.amount_cents = actualCostCents;
    payment.status = 'completed';
    payment.completed_at = new Date();

    console.log(`[PaymentService] Completed payment: ${nodePayout} cents to node, ${feeCents} cents fee`);

    return true;
  }

  /**
   * Refund a held payment (job failed or cancelled)
   */
  async refundPayment(paymentId: string): Promise<boolean> {
    const payment = this.payments.get(paymentId);
    if (!payment || payment.status !== 'pending') {
      return false;
    }

    const clientAccount = this.accounts.get(payment.from_account);
    if (!clientAccount) {
      return false;
    }

    // Refund full amount
    clientAccount.balance_cents += payment.amount_cents;
    payment.status = 'refunded';
    payment.completed_at = new Date();

    console.log(`[PaymentService] Refunded ${payment.amount_cents} cents for job ${payment.job_id}`);

    return true;
  }

  /**
   * Request a withdrawal
   * In production, this would create an outbound payment via BTCPay Server
   */
  async requestWithdraw(accountId: string, amountCents: number, destinationAddress: string): Promise<{
    withdraw_id: string;
    status: string;
    estimated_time: string;
  }> {
    const account = this.accounts.get(accountId);
    if (!account) {
      throw new Error('Account not found');
    }

    if (account.balance_cents < amountCents) {
      throw new Error('Insufficient balance');
    }

    // Deduct from balance
    account.balance_cents -= amountCents;

    const withdrawId = uuidv4();

    console.log(`[PaymentService] STUB: Withdrawal ${withdrawId} for ${amountCents} cents to ${destinationAddress}`);

    return {
      withdraw_id: withdrawId,
      status: 'pending',
      estimated_time: '10-30 minutes',
    };
  }

  /**
   * Get payment history for an account
   */
  getPaymentHistory(accountId: string): Payment[] {
    return Array.from(this.payments.values())
      .filter((p) => p.from_account === accountId || p.to_account === accountId)
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
  }

  /**
   * Get platform statistics
   */
  getStats(): {
    total_accounts: number;
    total_balance_cents: number;
    total_payments: number;
    total_volume_cents: number;
    platform_fees_cents: number;
  } {
    const accounts = Array.from(this.accounts.values());
    const payments = Array.from(this.payments.values());

    return {
      total_accounts: accounts.length - 1, // Exclude system account
      total_balance_cents: accounts.reduce((sum, a) => sum + a.balance_cents, 0),
      total_payments: payments.filter((p) => p.status === 'completed').length,
      total_volume_cents: payments
        .filter((p) => p.status === 'completed')
        .reduce((sum, p) => sum + p.amount_cents, 0),
      platform_fees_cents: this.accounts.get(this.systemAccountId)?.balance_cents || 0,
    };
  }
}
