import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Header } from './components/common/Header';
import { Dashboard } from './pages/Dashboard';
import { SingleAnalysis } from './pages/SingleAnalysis';
import { BatchAnalysis } from './pages/BatchAnalysis';
import { CandidateDashboard } from './pages/CandidateDashboard';
import { AppMarketplace } from './pages/AppMarketplace';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50/50 flex flex-col font-sans">
        <Header />
        <main className="flex-grow">
          <Routes>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/" element={<SingleAnalysis />} />
            <Route path="/batch" element={<BatchAnalysis />} />
            <Route path="/candidate" element={<CandidateDashboard />} />
            <Route path="/marketplace" element={<AppMarketplace />} />
          </Routes>
        </main>
        <footer className="bg-white border-t border-gray-200 mt-12 py-6">
          <div className="max-w-7xl mx-auto px-4 flex justify-between items-center text-sm text-gray-500">
            <p>Academic CV Analyzer &copy; {new Date().getFullYear()}</p>
            <p className="flex items-center gap-1">Powered by Claude 3.5 Sonnet</p>
          </div>
        </footer>
      </div>
    </Router>
  );
}

export default App;
