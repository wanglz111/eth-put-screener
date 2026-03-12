/**
 * Test script for risk-free rate API integration
 */
import { fetchRiskFreeRate, fetchRiskFreeRateWithFallback } from "../src/services/riskFreeRate";

async function main() {
  console.log("Testing risk-free rate API integration...\n");

  try {
    console.log("1. Fetching current Treasury Bills rate...");
    const rate = await fetchRiskFreeRate();
    console.log(`   ✓ Success: ${(rate * 100).toFixed(3)}% (${rate})`);
    console.log(`   Previous hardcoded rate: 2.000% (0.02)\n`);

    console.log("2. Testing with fallback...");
    const rateWithFallback = await fetchRiskFreeRateWithFallback(0.02);
    console.log(`   ✓ Success: ${(rateWithFallback * 100).toFixed(3)}% (${rateWithFallback})\n`);

    console.log("✓ All tests passed!");
  } catch (error) {
    console.error("✗ Test failed:", error);
    process.exit(1);
  }
}

main();
