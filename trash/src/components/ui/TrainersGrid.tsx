import TrainerCard from './TrainerCard';

interface Props {
  trainers: any[];
}

export default function TrainersGrid({ trainers }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {trainers.map((trainer) => (
        <TrainerCard key={trainer.id} trainer={trainer} />
      ))}
    </div>
  );
}
