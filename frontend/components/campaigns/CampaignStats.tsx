"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Line, LineChart, CartesianGrid } from "recharts";
import { Card, CardContent } from "@/components/ui/card";

export function CampaignStats({ campaign }: { campaign: any }) {
  const donutData = [
    { name: "Sent", value: campaign.sent_count || 0, color: "#6C63FF" },
    { name: "Delivered", value: campaign.delivered_count || 0, color: "#00D9A6" },
    { name: "Read", value: campaign.read_count || 0, color: "#4DA6FF" },
    { name: "Replied", value: campaign.replied_count || 0, color: "#FFB830" },
    { name: "Failed", value: campaign.failed_count || 0, color: "#FF4D6A" }
  ];

  const lineData = [
    { label: "Queued", value: campaign.total_leads || 0 },
    { label: "Sent", value: campaign.sent_count || 0 },
    { label: "Read", value: campaign.read_count || 0 },
    { label: "Replies", value: campaign.replied_count || 0 }
  ];

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardContent className="space-y-4">
          <p className="text-lg font-semibold text-textPrimary">Messages over time</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData}>
                <CartesianGrid stroke="#2A2A3D" strokeDasharray="3 3" />
                <XAxis dataKey="label" stroke="#9898B8" />
                <YAxis stroke="#9898B8" />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#6C63FF" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-4">
          <p className="text-lg font-semibold text-textPrimary">Status breakdown</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={donutData} dataKey="value" cx="50%" cy="50%" innerRadius={70} outerRadius={110}>
                  {donutData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
