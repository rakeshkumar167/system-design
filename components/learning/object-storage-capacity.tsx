import {
  calculateObjectStorageCapacity,
  type ObjectStorageCapacityAssumptions,
} from "@/lib/object-storage-estimates";
import { CapacityTable, type AssumptionRow, type ResultRow } from "./capacity-table";

function fmt(n: number, digits = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function ObjectStorageCapacity({
  assumptions,
}: {
  assumptions: ObjectStorageCapacityAssumptions;
}) {
  const r = calculateObjectStorageCapacity(assumptions);

  const assumptionRows: AssumptionRow[] = [
    { label: "Objects stored", value: fmt(assumptions.objectsStored) },
    { label: "Avg object size", value: `${fmt(assumptions.avgObjectBytes)} B` },
    { label: "Data shards (k)", value: fmt(assumptions.dataShards) },
    { label: "Parity shards (m)", value: fmt(assumptions.parityShards) },
    { label: "Replication factor (compare)", value: `${fmt(assumptions.replicationFactor)}×` },
  ];

  const results: ResultRow[] = [
    { label: "Logical data", value: `${fmt(r.logicalDataPb)} PB`, consequence: "A trillion 1 MB objects — an exabyte. The bytes are only half the problem; the trillion keys drive the metadata design." },
    { label: "Stored (erasure coding)", value: `${fmt(r.erasureStoredPb)} PB`, consequence: "8+4 Reed-Solomon: 1.5× overhead — the object survives any 4 fragment losses at a fraction of replication's cost." },
    { label: "Stored (3× replication)", value: `${fmt(r.replicationStoredPb)} PB`, consequence: "Full copies for comparable durability — twice the raw capacity of erasure coding." },
    { label: "Storage saved by EC", value: `${fmt(r.storageSavedPb)} PB`, consequence: "Halving the storage bill at exabyte scale is why durability comes from erasure coding, not replication." },
    { label: "Fragment losses tolerated", value: fmt(r.fragmentFailuresTolerated), consequence: "Any m fragments can be lost and rebuilt from the survivors — spread across failure domains so correlated failures stay under m." },
  ];

  return <CapacityTable assumptions={assumptionRows} results={results} />;
}
