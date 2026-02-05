-- Create wallet_history table to track balance changes over time
CREATE TABLE IF NOT EXISTS wallet_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL,
  balance NUMERIC NOT NULL,
  btc_price NUMERIC NOT NULL,
  daily_pnl NUMERIC,
  daily_return_pct NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for efficient timestamp queries
CREATE INDEX IF NOT EXISTS idx_wallet_history_timestamp ON wallet_history(timestamp DESC);

-- Add comment
COMMENT ON TABLE wallet_history IS 'Historical wallet balance tracking with BTC price comparison';
