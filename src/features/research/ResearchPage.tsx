import { Link } from "react-router-dom";
import { ResearchHub } from "./ResearchHub";

/**
 * Research hub — outcomes learning + historical lab studies.
 * Compatibility: /admin#admin-lab-pane still hosts Admin Lab.
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
      <ResearchHub />
    </div>
  );
}
