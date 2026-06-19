import { useParams } from "react-router-dom";
import { useNavigate } from "react-router-dom";

export function Topic() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate("/")}
          className="text-gray-400 hover:text-gray-600 text-sm"
        >
          ← Topics
        </button>
        <span className="text-gray-300">|</span>
        <span className="text-sm font-medium text-gray-700">{slug}</span>
      </header>
      <div className="flex-1 flex items-center justify-center text-gray-400">
        <p>Chat coming soon (Issue #4)</p>
      </div>
    </div>
  );
}
