export default function VideosPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <div className="glow-border rounded-lg bg-panel p-12 text-center max-w-md">
        <div className="text-accent text-4xl mb-4">▶</div>
        <h2 className="text-accent font-mono text-lg font-bold tracking-widest uppercase mb-3">
          Video Briefings
        </h2>
        <p className="text-muted text-sm font-mono leading-relaxed">
          Latest clips and live streams from selected intelligence
          channels and news outlets will be displayed here.
        </p>
        <div className="mt-6 border-t border-border pt-4">
          <span className="text-muted/50 text-[10px] font-mono tracking-widest uppercase">
            [ VIDEO FEED PENDING // STEP 2 ]
          </span>
        </div>
      </div>
    </div>
  );
}
