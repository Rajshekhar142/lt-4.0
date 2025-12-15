import { NextResponse } from "next/server";
import connectDB from "../../../lib/db";
import { Domain, Task } from "../../../models/Core";

export async function GET() {
  try {
    await connectDB();

    // 1. Wipe the slate clean (Optional, good for dev)
    await Domain.deleteMany({});
    await Task.deleteMany({});

    // 2. Create Domains
    const domains = [
      { name: "Physical", color: "#e11d48", order: 1 },  // Red
      { name: "Financial", color: "#059669", order: 2 }, // Green
      { name: "Social", color: "#2563eb", order: 3 },    // Blue
      { name: "Spiritual", color: "#7c3aed", order: 4 }, // Purple
    ];
    const createdDomains = await Domain.insertMany(domains);

    // 3. Create Sample Tasks
    const tasks = [
      { title: "Workout", points: 5, domain: "Physical" },
      { title: "Drink Water", points: 1, domain: "Physical" },
      { title: "No Spending", points: 3, domain: "Financial" },
      { title: "Call Parents", points: 5, domain: "Social" },
      { title: "Meditate", points: 2, domain: "Spiritual" },
    ];

    for (const t of tasks) {
      const domain = createdDomains.find(d => d.name === t.domain);
      if (domain) {
        await Task.create({
          domainId: domain._id,
          title: t.title,
          points: t.points
        });
      }
    }

    return NextResponse.json({ message: "Ready to grind! Database seeded." });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}