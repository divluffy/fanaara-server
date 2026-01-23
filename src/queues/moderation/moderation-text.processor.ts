import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { TextModerationService } from 'src/moderation/text/text-moderation.service';

type JobData = {
  items: Array<{ text: string; context?: any }>;
  userId: string;
};

@Processor('moderation-text')
export class ModerationTextProcessor extends WorkerHost {
  private readonly logger = new Logger(ModerationTextProcessor.name);

  constructor(private readonly text: TextModerationService) {
    super();
  }

  async process(job: Job<JobData>) {
    this.logger.log(
      `[job:text] id=${job.id} user=${job.data.userId} count=${job.data.items.length}`,
    );
    const decisions = await this.text.moderateMany(job.data.items);
    const allowed = decisions.every((d) => d.allowed);
    return { allowed, decisions };
  }
}
