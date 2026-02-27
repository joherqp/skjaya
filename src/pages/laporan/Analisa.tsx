import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Table } from 'lucide-react';
import AnalisaVisual from '@/components/laporan/AnalisaVisual';
import AnalisaPivot from '@/components/laporan/AnalisaPivot';


export default function Analisa() {
  return (
    <MainLayout title="Analisa Bisnis">
      <div className="p-4 space-y-4">
        <Tabs defaultValue="visual" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
            <TabsTrigger value="visual" className="flex items-center gap-2">
                <BarChart className="w-4 h-4" />
                Analisa Visual
            </TabsTrigger>
            <TabsTrigger value="pivot" className="flex items-center gap-2">
                <Table className="w-4 h-4" />
                Pivot Table
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="visual" className="mt-4">
            <AnalisaVisual />
          </TabsContent>
          
          <TabsContent value="pivot" className="mt-4">
            <AnalisaPivot />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
