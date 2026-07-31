import { useState, useEffect } from "react";
import constants, { buildPresenceChecklist, METRIC_CONFIG } from "../constants";

import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min?url";
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

function App() {
  const [aiReady, setAiReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [resumeText, setResumeText] = useState(" ");
  const [presenceChecklist, setPresenceChecklist] = useState([]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (window.puter?.ai?.chat) {
        setAiReady(true);
        clearInterval(interval);
      }
    }, 300);
    return () => clearInterval(interval);
  }, []);

  const extractPDFText = async (file) => {
    const arrayBuffer = await file.arrayBuffer(); //this is how pdfjs understands pdf
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const texts = await Promise.all(
      Array.from({ length: pdf.numPages }, (_, i) =>
        pdf
          .getPage(i + 1)
          .then((page) =>
            page
              .getTextContent()
              .then((tc) => tc.items.map((i) => i.str).join(" ")),
          ),
      ),
    );
    return texts.join("\n").trim();
  };

  const parseJSONResponse = (reply) => {
    try {
      const match = reply.match(/\{[\s\S]*\}/);
      const parsed = match ? JSON.parse(match[0]) : {};
      if (!parsed.overallScore && !parsed.error) {
        throw new Error("Invalid Ai Response");
      }
      return parsed;
    } catch (error) {
      throw new Error(`Failed to Parse ${error.message}`);
    }
  };
  const score = parseInt(analysis?.overallScore) || 0;
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const progress = circumference - (score / 10) * circumference;

  const analyzeResume = async (text) => {
    const prompt = constants.ANALYZE_RESUME_PROMPT.replace(
      "{{DOCUMENT_TEXT}}",
      text,
    );
    const response = await window.puter.ai.chat(
      [
        {
          role: "system",
          content: " You are an expert resume analyzer....",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      {
        model: "gpt-4o",
      },
    );

    const result = parseJSONResponse(
      typeof response === "string" ? response : response.message?.content || "",
    );
    if (result.error) throw new Error(result.error);
    return result;
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || file.type !== "application/pdf") {
      return alert(" Plaese upload a PDF file Only ");
    }
    setUploadFile(file);
    setIsLoading(true);
    setAnalysis(null);
    setResumeText("");
    setPresenceChecklist([]);

    try {
      const text = await extractPDFText(file);
      setResumeText(text);
      setPresenceChecklist(buildPresenceChecklist(text));
      setAnalysis(await analyzeResume(text));
    } catch (err) {
      alert(`Error : ${err.message}`);
      reset();
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setUploadFile(null);
    setAnalysis(null);
    setResumeText("");
    setPresenceChecklist([]);
  };
  return (
    <div className="min-h-screen bg-main-gradient p-4 sm:p-6 lg:p-8 flex items-center justify-center">
      <div className="max-w-5xl mx-auto w-full">
        <div className="text-center mb-6 ">
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-light bg-gradient-to-r from-cyan-300 via-teal-200 to-sky-300 bg-clip-text text-transparent mb-2">
            ResumeLens
          </h1>
          <h2 className="text-3xl text-slate-300  ">An Ai resume analyzer</h2>
          <p className="text-slate-300 text-sm sm:text-base">
            Upload your PDF resume and get instant AI feedback
          </p>
        </div>
        {!uploadFile && (
          <div className="upload-area">
            <div className="upload-zone">
              <div className="text-4xl sm:text-5xl lg:text-6xl mb-4">📄</div>

              <p className="text-sm sm:text-m text-slate-200 mb-2">
                PDF files only ● Get Instant analysis{" "}
              </p>
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileUpload}
                disabled={!aiReady}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className={`inline-block btn-primary ${
                  !aiReady ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                Upload Your Resume
              </label>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="p-6 sm:p-8 max-w-md mx-auto">
            <div className="text-container">
              <div className="loading-spinner"></div>
              <h3 className="text-lg text-center sm:text-xl text-slate-200 mb-2 ">
                Analyzing Your resume
              </h3>
              <p className="text-center  text-slate-400 text-sm sm:text-base">
                Please wait while we analyze your resume
              </p>
            </div>
          </div>
        )}

        {analysis && uploadFile && (
          <div className="space-y-6 p-4 sm:px-8 lg:px-16">
            <div className="file-info-card">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-4">
                  <div className="icon-container-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border-blue-500/30">
                    <span className="text-3xl">📄</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-green-500 mb-1">
                      Analysis Complete
                    </h3>
                    <p className="text-slate-300 text-sm break-all">
                      {uploadFile.name}
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={reset} className="btn-secondary">
                    New analysis
                  </button>
                </div>
              </div>
            </div>

            <div className="score-card">
              <div className="text-center mb-6">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <span className="text-2xl">🌟</span>
                  <h2 className="text-2xl sm:text-3xlfont-bold text-white">
                    Your Score
                  </h2>
                </div>
                {/* <div className="relative">
                  <p className="text-6xl sm:text-8xl font-extrabold text-cyan-400 drop-show-lg">
                    {analysis.overallScore || "6"}
                  </p>
                </div> */}

                {/* Incase i would need to change how it looks  */}
                <div className="flex justify-center my-6">
                  <div className="relative w-44 h-44">
                    <svg className="w-44 h-44 -rotate-90">
                      <circle
                        cx="88"
                        cy="88"
                        r={radius}
                        stroke="#334155"
                        strokeWidth="12"
                        fill="none"
                      />

                      <circle
                        cx="88"
                        cy="88"
                        r={radius}
                        stroke={
                          score >= 8
                            ? "#22c55e"
                            : score >= 6
                              ? "#eab308"
                              : "#ef4444"
                        }
                        strokeWidth="12"
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={progress}
                        className="transition-all duration-1000"
                      />
                    </svg>

                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <p className="text-5xl font-extrabold text-cyan-400">
                        {score}
                      </p>
                      <span className="text-slate-400 text-lg">/10</span>
                    </div>
                  </div>
                </div>
                <div
                  className={`inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-full ${parseInt(analysis.overallScore) >= 8 ? "score-status-excellent" : parseInt(analysis.overallScore) >= 6 ? "score-status-good" : "score-status-improvement"}`}
                >
                  <span className="text-lg">
                    {parseInt(analysis.overallScore) >= 8
                      ? "🌞"
                      : parseInt(analysis.overallScore) >= 6
                        ? "🌟"
                        : "📈"}
                  </span>

                  <span className="semi-bold text-lg">
                    {parseInt(analysis.overallScore) >= 8
                      ? "Excellent"
                      : parseInt(analysis.overallScore) >= 6
                        ? "Good"
                        : "Can do better"}
                  </span>
                </div>
              </div>

              <div className="progress-bar">
                <div
                  className={`h-full  rounded-full transition-all duration-1000 ease-out shadow-sm ${parseInt(analysis.overallScore) >= 8 ? "progress-excellent" : parseInt(analysis.overallScore) >= 6 ? "progress-good" : "progress-improvement"}`}
                  style={{
                    width: `${(parseInt(analysis.overallScore) / 10) * 100}%`,
                  }}
                ></div>
              </div>
              <p className="text-slate-400 text-sm mt-3 text-center font-medium">
                Score based on content quality , formatting and keyword usage
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="feature-card-green group">
                <div className="bg-green-500/20 icon-container-lg mx-auto mb-3 group-hover:bg-green-400/30 transition-colors">
                  <span className="text-green-300 text-xl">⩗</span>
                </div>
                <h4 className="text-green-400 text-sm font-semibold uppercase tracking-wide mb-3">
                  Top Strengths
                </h4>
                <div className="space-y-2 text-left">
                  {analysis.strengths.slice(0, 3).map((strengths, index) => (
                    <div key={index} className="list-item-green">
                      <span className="text-green-400 text-sm mt-0.5">●</span>
                      <span className="text-slate-200 font-medium text-sm loading-relaxed">
                        {strengths}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="feature-card-orange group">
                <div className="bg-orange-500/20 icon-container-lg mx-auto mb-3 group-hover:bg-orange-400/30 transition-colors">
                  <span className="text-orange-300 text-xl">📊</span>
                </div>
                <h4 className="text-orange-400 text-sm font-semibold uppercase tracking-wide mb-3">
                  Improvements
                </h4>
                <div className="space-y-2 text-left">
                  {analysis.improvements
                    .slice(0, 3)
                    .map((improvements, index) => (
                      <div key={index} className="list-item-orange">
                        <span className="text-orange-400 text-sm mt-0.5">
                          ●
                        </span>
                        <span className="text-slate-200 font-medium text-sm loading-relaxed">
                          {improvements}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
            <div className="section-card-group">
              <div className="section-card">
                <div className="flex items-center gap-3 mb-4">
                  <div className="icon-container bg-purple-500/20">
                    <span className="text-purple-300 text-lg">📄</span>
                  </div>

                  <h4 className="text-lg font-semibold text-slate-100">
                    Executive Summary
                  </h4>
                </div>
                <div className="summary-box">
                  <p className="text-slate-200 text-sm sm:text-base leading-relaxed">
                    {analysis.summary}
                  </p>
                </div>
              </div>
            </div>

            <div className="section-card group ">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-cyan-500/20 icon-container-lg group-hover:bg-cyan-400/30 transition-colors">
                  <span className="text-cyan-300 text-xl">📈</span>
                </div>

                <h4 className="text-cyan-400 text-lg font-semibold uppercase tracking-wide">
                  Performance Metrics
                </h4>
              </div>
              <div className="space-y-4">
                {METRIC_CONFIG.map((cfg, i) => {
                  const value =
                    analysis.performanceMetrics?.[cfg.key] ?? cfg.defaultValue;
                  return (
                    <div key={i} className="group/item">
                      <div className="flex items-center justify-between mb-2 ">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{cfg.icon}</span>
                          <p className="text-slate-200 font-medium">
                            {cfg.label}
                          </p>
                        </div>
                        <span className="text-cyan-300 font-bold">
                          {value}/10
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-1000 ${
                            value >= 8
                              ? "bg-green-500"
                              : value >= 6
                                ? "bg-yellow-500"
                                : "bg-red-500"
                          }`}
                          style={{
                            width: `${(value / 10) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="section-card group">
              <div className="flex items-center gap-3 mb-6">
                <div className="icon-container bg-purple-500/20">
                  <span className="text-lg text-purple-300">🔍</span>
                </div>
                <h2 className="text-xl font-semibold text-purple-400">
                  Resume Insights
                </h2>
              </div>
              <div className="grid gap-4">
                <div className="info-box-cyan group/item">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-lg text-cyan-400">🌿</span>
                    <h3 className="text-cyan-400 font-semibold">
                      Action Items
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {(
                      analysis.actionItems || [
                        "Optimize Keyboard placement for better ATS scoring",
                        "Enhance content with quantifiable achievements",
                        "consider industry-specific terminology",
                      ]
                    ).map((item, index) => (
                      <div className="list-item-cyan" key={index}>
                        <span className="text-cyan-400">●</span>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="info-box-emerald group/item">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-lg">💡</span>
                    <h3 className="text-emerald-300 font-semibold">Pro-Tips</h3>
                  </div>
                  <div className="space-y-2">
                    {(
                      analysis.proTips || [
                        "Action verbs to start bullet points",
                        "Keep descriptions concise and impactful",
                        "Tailor keywords to specific job descriptions",
                      ]
                    ).map((tip, index) => (
                      <div className="list-item-emerald" key={index}>
                        <span className="text-emerald-400">●</span>
                        <span>{tip}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="section-card group">
              <div className="flex items-center gap-3 mb-6">
                <div className="icon-container bg-purple-500/20">
                  <span className="text-lg text-purple-300">🔍</span>
                </div>
                <h2 className="text-xl font-semibold text-purple-400">
                  ATS Optimization
                </h2>
              </div>
              <h3>
                <span className="font-semibold text-purple-500">
                  What is ATS?
                </span>{" "}
              </h3>
              <p className="text-slate-300 text-sm leading-relaxed mb-4">
                An <strong>Applicant Tracking System (ATS)</strong> is software
                that recruiters use to scan, filter, and rank resumes before
                they reach a hiring manager. Optimizing your resume improves its
                chances of passing these automated screenings.
              </p>

              <div className="info-box-violet group/item">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-violet-300 font-semibold">
                    ATS Compatability Checklist
                  </h3>
                </div>
                <div className="space-y-2">
                  {(presenceChecklist || []).map((item, index) => (
                    <div
                      className="flex items-start gap-2 text-slate-200"
                      key={index}
                    >
                      <span
                        className={`${item.present ? "text-emerald-400" : "text-red-400"}`}
                      >
                        {item.present ? "✅" : "❌"}
                      </span>
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
