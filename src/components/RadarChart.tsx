"use client";

interface RadarProps {
  domains: any[];
  tasks: any[];
}

export default function RadarChart({ domains, tasks }: RadarProps) {
  // 1. Calculate Scores (0 to 1) for each axis
  // We need to map specific domains to specific axes (Top, Right, Bottom, Left)
  // Let's assume the order based on your seed: Physical, Financial, Social, Spiritual
  
  const getDomainScore = (domainName: string) => {
    // Find the domain ID by name
    const domain = domains.find(d => d.name === domainName);
    if (!domain) return 0;

    const domainTasks = tasks.filter(t => t.domainId === domain._id);
    if (domainTasks.length === 0) return 0;

    const total = domainTasks.reduce((acc, t) => acc + t.points, 0);
    const earned = domainTasks.filter(t => t.isCompleted).reduce((acc, t) => acc + t.points, 0);
    
    return total > 0 ? earned / total : 0;
  };

  const scores = [
    getDomainScore("Physical"),  // Top
    getDomainScore("Financial"), // Right
    getDomainScore("Social"),    // Bottom
    getDomainScore("Spiritual"), // Left
  ];

  // 2. SVG Configuration
  const size = 200;
  const center = size / 2;
  const radius = 80; // How big the chart is inside the box

  // 3. Calculate Coordinates
  // Math: Center + (Radius * Score * Direction)
  const points = [
    { x: center, y: center - (radius * scores[0]) }, // Top
    { x: center + (radius * scores[1]), y: center }, // Right
    { x: center, y: center + (radius * scores[2]) }, // Bottom
    { x: center - (radius * scores[3]), y: center }, // Left
  ];

  // Convert points to SVG polygon string: "100,20 180,100..."
  const polygonPoints = points.map(p => `${p.x},${p.y}`).join(" ");

  // Background Guide (The full diamond)
  const fullDiamond = `
    ${center},${center - radius} 
    ${center + radius},${center} 
    ${center},${center + radius} 
    ${center - radius},${center}
  `;

  return (
    <div className="flex flex-col items-center justify-center py-6">
      <div className="relative">
        <svg width={size} height={size} className="overflow-visible">
          
          {/* 1. Background Grid (The target shape) */}
          <polygon points={fullDiamond} fill="none" stroke="#262626" strokeWidth="2" />
          {/* Inner Grid (50% mark) */}
          <polygon 
            points={`
              ${center},${center - radius/2} 
              ${center + radius/2},${center} 
              ${center},${center + radius/2} 
              ${center - radius/2},${center}
            `} 
            fill="none" 
            stroke="#262626" 
            strokeWidth="1" 
            strokeDasharray="4 4" 
          />
          
          {/* 2. Crosshairs (Axes) */}
          <line x1={center} y1={center - radius} x2={center} y2={center + radius} stroke="#262626" strokeWidth="1" />
          <line x1={center - radius} y1={center} x2={center + radius} y2={center} stroke="#262626" strokeWidth="1" />

          {/* 3. The Player Stats Polygon (Your Progress) */}
          <polygon 
            points={polygonPoints} 
            fill="rgba(255, 255, 255, 0.2)" 
            stroke="white" 
            strokeWidth="2"
            className="transition-all duration-700 ease-out"
          />

          {/* 4. The Dots at the tips */}
          {points.map((p, i) => (
            <circle 
              key={i} 
              cx={p.x} 
              cy={p.y} 
              r="3" 
              fill="white" 
              className="transition-all duration-700 ease-out"
            />
          ))}

          {/* 5. Labels */}
          <text x={center} y={center - radius - 15} textAnchor="middle" fill="#ef4444" className="text-[10px] font-bold uppercase tracking-widest">PHY</text>
          <text x={center + radius + 20} y={center + 4} textAnchor="middle" fill="#22c55e" className="text-[10px] font-bold uppercase tracking-widest">FIN</text>
          <text x={center} y={center + radius + 20} textAnchor="middle" fill="#3b82f6" className="text-[10px] font-bold uppercase tracking-widest">SOC</text>
          <text x={center - radius - 20} y={center + 4} textAnchor="middle" fill="#a855f7" className="text-[10px] font-bold uppercase tracking-widest">SPI</text>
        </svg>
      </div>
    </div>
  );
}