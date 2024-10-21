import { FastifyInstance } from 'fastify';
import {
  ServerOptions,
  ChainhookNodeOptions,
  ServerPredicate,
  OnEventCallback,
  buildServer,
} from './server';
import { predicateHealthCheck } from './predicates';

/**
 * Local web server that registers predicates and receives events from a Chainhook node. It handles
 * retry logic and node availability transparently and provides a callback for individual event
 * processing.
 *
 * Predicates registered here do not accept a `then_that` entry as this will be configured
 * automatically to redirect events to this server.
 *
 * Events relayed by this component will include the original predicate's UUID so actions can be
 * taken for each relevant predicate.
 */
export class ChainhookEventObserver {
  private fastify?: FastifyInstance;
  private serverOpts: ServerOptions;
  private chainhookOpts: ChainhookNodeOptions;
  private healthCheckTimer?: NodeJS.Timer;

  constructor(serverOpts: ServerOptions, chainhookOpts: ChainhookNodeOptions) {
    this.serverOpts = serverOpts;
    this.chainhookOpts = chainhookOpts;
  }

  /**
   * Start the Chainhook event server.
   * @param predicates - Predicates to register
   * @param callback - Function to handle every Chainhook event payload sent by the node
   */
  async start(predicates: ServerPredicate[], callback: OnEventCallback): Promise<void> {
    if (this.fastify) return;
    this.fastify = await buildServer(this.serverOpts, this.chainhookOpts, predicates, callback);
    await this.fastify.listen({ host: this.serverOpts.hostname, port: this.serverOpts.port });
    if (this.serverOpts.predicate_health_check_interval_ms && this.healthCheckTimer === undefined) {
      this.healthCheckTimer = setInterval(() => {
        void predicateHealthCheck(predicates, this.serverOpts, this.chainhookOpts);
      }, this.serverOpts.predicate_health_check_interval_ms);
    }
  }

  /**
   * Stop the Chainhook event server gracefully.
   */
  async close(): Promise<void> {
    if (this.healthCheckTimer) clearInterval(this.healthCheckTimer);
    this.healthCheckTimer = undefined;
    await this.fastify?.close();
    this.fastify = undefined;
  }
}

export * from './schemas/bitcoin/if_this';
export * from './schemas/bitcoin/payload';
export * from './schemas/common';
export * from './schemas/payload';
export * from './schemas/predicate';
export * from './schemas/stacks/if_this';
export * from './schemas/stacks/payload';
export * from './schemas/stacks/tx_events';
export * from './schemas/stacks/tx_kind';
export * from './server';
