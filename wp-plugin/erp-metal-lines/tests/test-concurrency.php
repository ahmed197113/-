<?php
/** الترقيم المتسلسل تحت التزامن: 4 عمليات PHP منفصلة × 50 رقماً ⇒ 200 رقم بدون أي تكرار أو فجوة. */
class Test_Concurrency extends ERP_TestCase
{
    public function test_parallel_sequence_numbers_are_unique(): void
    {
        $worker = __DIR__ . '/bin/seq-worker.php';
        $procs = [];
        for ($i = 0; $i < 4; $i++) {
            $procs[] = proc_open([PHP_BINARY, $worker, '50'], [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
            $pp[$i] = $pipes;
        }
        $all = [];
        foreach ($procs as $i => $p) {
            $out = stream_get_contents($pp[$i][1]);
            $err = stream_get_contents($pp[$i][2]);
            proc_close($p);
            $nums = json_decode(trim(substr($out, (int) strrpos($out, '['))), true);
            $this->assertIsArray($nums, "worker {$i} failed: {$err} {$out}");
            $all = array_merge($all, $nums);
        }
        $this->assertCount(200, $all);
        $this->assertCount(200, array_unique($all), 'duplicate sequence numbers!');
        sort($all);
        $this->assertSame('JV-00001', $all[0]);
        $this->assertSame('JV-00200', $all[199]);
    }
}
