import Link from "next/link";
import { ChainQueryDemo } from "../_components/ChainQueryDemo";

export default function ChainQueryPage() {
  return (
    <div className="flex flex-col gap-8 items-center sm:items-start w-full px-3 md:px-0">
      {/* Navigation */}
      <div className="w-full flex justify-center gap-4 mb-4">
        <Link
          href="/"
          className="px-6 py-2 bg-black text-[#F4F4F4] font-semibold rounded-lg hover:bg-[#1F1F1F] transition-colors"
        >
          🔢 FHE Counter
        </Link>
        <Link
          href="/batch-decrypt"
          className="px-6 py-2 bg-black text-[#F4F4F4] font-semibold rounded-lg hover:bg-[#1F1F1F] transition-colors"
        >
          🔓 批量解密
        </Link>
        <Link
          href="/chain-query"
          className="px-6 py-2 bg-[#FFD208] text-[#2D2D2D] font-semibold rounded-lg hover:bg-[#A38025] transition-colors"
        >
          📊 链上查询
        </Link>
        <Link
          href="/webworker"
          className="px-6 py-2 bg-black text-[#F4F4F4] font-semibold rounded-lg hover:bg-[#1F1F1F] transition-colors"
        >
          ⚡ WebWorker
        </Link>
      </div>
      <ChainQueryDemo />
    </div>
  );
}

