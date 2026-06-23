import {
  calculateNotificationCapacity,
  type NotificationCapacityAssumptions,
} from "@/lib/notification-estimates";
import { CapacityTable, type AssumptionRow, type ResultRow } from "./capacity-table";

function fmt(n: number, digits = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function NotificationCapacity({
  assumptions,
}: {
  assumptions: NotificationCapacityAssumptions;
}) {
  const r = calculateNotificationCapacity(assumptions);

  const assumptionRows: AssumptionRow[] = [
    { label: "Notifications / day", value: fmt(assumptions.notificationsPerDay) },
    { label: "Fan-out factor", value: `${fmt(assumptions.fanoutFactor)}× channels` },
    { label: "Peak multiplier", value: `${fmt(assumptions.peakMultiplier)}×` },
    { label: "Retry overhead", value: `${fmt(assumptions.retryOverheadPercent)}%` },
    { label: "Avg payload", value: `${fmt(assumptions.avgPayloadBytes)} B` },
  ];

  const results: ResultRow[] = [
    { label: "Accept QPS (avg)", value: fmt(r.averageSendQps), consequence: "The accept path is cheap — a thin API returns 202 and enqueues; it is never the bottleneck." },
    { label: "Delivery QPS (avg)", value: fmt(r.averageDeliveryQps), consequence: "Fan-out doubles the load: one notification becomes N per-channel deliveries to push through queues." },
    { label: "Delivery QPS (peak)", value: fmt(r.peakDeliveryQps), consequence: "Provision the delivery tier and provider throughput for peak, not average." },
    { label: "Delivery attempts / sec", value: fmt(r.deliveryAttemptsPerSecond), consequence: "Retries add overhead on top of fan-out — the real work the channel workers perform." },
    { label: "Daily deliveries", value: fmt(r.dailyDeliveries), consequence: "A billion provider calls a day — the scale that justifies async queues and autoscaled workers." },
  ];

  return <CapacityTable assumptions={assumptionRows} results={results} />;
}
