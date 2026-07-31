import { Link } from "react-router-dom";
import { LabPane } from "@/features/admin/lab/LabPane";

/**
 * Research hub — historical evidence and lab studies.
 * Reuses Admin Lab (Research-Stats + Lab1). Compatibility: /admin#admin-lab-pane
 */
export function ResearchPage() {
  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ocean-foam sm:text-4xl">
          Research
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-relaxed text-ocean-sand">
          Historical evidence and learning studies — not part of the time-sensitive Today workflow.
          Legacy Admin Lab entry remains at{" "}
          <Link to="/admin#admin-lab-pane" className="text-ocean-teal hover:underline">
            Admin → Lab
          </Link>
          .
        </p>
      </div>
      <LabPane />
    </div>
  );
}
