import { longArm } from '../physics/geometry';
import type { Design, FailureCode, Results } from '../physics/types';

export const FAILURE_TEXT: Record<FailureCode, { title: string; why: string }> = {
  blocked: { title: "This build can't work", why: '' },
  weightCrash: {
    title: 'CRASH! The weight hit the ground',
    why: 'The box smashed into the ground before the ball let go, so the arm stopped dead and nothing flew.',
  },
  ballTooBig: {
    title: 'The ball is bigger than the machine!',
    why: 'Its middle sits higher than the arm can reach, so the sling can’t pick it up.',
  },
  tooWeak: {
    title: "The weight is too light to lift the arm!",
    why: 'The arm and ball are heavier (on their side) than the counterweight, so nothing moves.',
  },
  neverReleased: {
    title: 'The ball never let go!',
    why: 'The sling never swung past the release hook, so the ball stayed stuck.',
  },
  groundRelease: {
    title: 'It let go too early!',
    why: 'The ball slipped out before it even left the ground.',
  },
  backward: {
    title: 'Whoops, it flew backward!',
    why: 'The ball let go way too early, while it was still swinging up behind the machine.',
  },
};

/** One "try this next" suggestion based on what just happened. */
export function nextTip(d: Design, r: Results | undefined, failure?: FailureCode): string {
  if (failure === 'weightCrash' || r?.weightCrashed)
    return 'Give the weight room to swing: make the tower taller, move the turning point toward the weight, or use a lighter weight. The warning in the Build tab has one-tap fixes.';
  if (failure === 'ballTooBig') return 'Pick a smaller ball, or build a much bigger machine (try the Size step).';
  if (failure === 'tooWeak') return 'Make the weight heavier, the arm lighter, or move the turning point toward the weight.';
  if (failure === 'neverReleased') return 'Bend the release hook MORE (a bigger angle) so the ball lets go sooner.';
  if (failure === 'groundRelease' || failure === 'backward')
    return 'Bend the release hook LESS (a smaller angle) so the ball holds on longer.';
  if (!r) return 'Change one thing and try again!';
  if (r.launchAngle > 60) return 'It went high but not far. Bend the release hook a little less so it lets go later and flies flatter.';
  if (r.launchAngle < 25) return 'It flew low and flat. Bend the release hook a little more so it lets go sooner and flies higher.';
  if (d.cwStyle === 'fixed') return 'Try a hinged weight. It swings and hands more of its energy to the ball.';
  if (d.slingLength < 0.75 * longArm(d)) return 'Try a longer sling, about as long as the long side of the arm.';
  if (r.energy.arm > 0.3) return 'A lot of energy is stuck spinning the heavy arm. Try a lighter arm.';
  if (d.cwMass / d.projectileMass > 300 && r.efficiency < 0.4)
    return 'The ball is very light for such a big weight. Try a heavier ball and watch the energy score.';
  if (r.energy.unused > 0.25) return "The weight hadn't finished falling when the ball let go. Try a longer sling or a smaller hook bend.";
  return 'Nice throw! Change just ONE thing and throw again to see what it does.';
}
