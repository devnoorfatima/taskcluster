import React, { Component, Fragment } from 'react';
import { func, string, bool, oneOfType, object, array } from 'prop-types';
import classNames from 'classnames';
import { equals, assocPath } from 'ramda';
import cloneDeep from 'lodash.clonedeep';
import CodeEditor from '@mozilla-frontend-infra/components/CodeEditor';
import Code from '@mozilla-frontend-infra/components/Code';
import Drawer from '@material-ui/core/Drawer';
import MarkdownTextArea from '@mozilla-frontend-infra/components/MarkdownTextArea';
import { withStyles } from '@material-ui/core/styles';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import TextField from '@material-ui/core/TextField';
import Switch from '@material-ui/core/Switch';
import FormGroup from '@material-ui/core/FormGroup';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Grid from '@material-ui/core/Grid';
import IconButton from '@material-ui/core/IconButton';
import Typography from '@material-ui/core/Typography';
import FlashIcon from 'mdi-react/FlashIcon';
import PlusIcon from 'mdi-react/PlusIcon';
import DeleteIcon from 'mdi-react/DeleteIcon';
import ContentSaveIcon from 'mdi-react/ContentSaveIcon';
import { docs } from 'taskcluster-lib-urls';
import ErrorPanel from '../ErrorPanel';
import Button from '../Button';
import SpeedDial from '../SpeedDial';
import SpeedDialAction from '../SpeedDialAction';
import DialogAction from '../DialogAction';
import DateDistance from '../DateDistance';
import HookLastFiredTable from '../HookLastFiredTable';
import PulseBindings from '../PulseBindings';
import { hook } from '../../utils/prop-types';
import removeKeys from '../../utils/removeKeys';

const initialHook = {
  metadata: {
    name: '',
    description: '',
    owner: '',
    emailOnError: true,
  },
  schedule: [],
  bindings: [],
  task: {
    provisionerId: 'aws-provisioner-v1',
    workerType: 'tutorial',
    payload: {
      image: 'ubuntu:14.04',
      command: ['/bin/bash', '-c', 'echo "hello World"'],
      maxRunTime: 60 * 10,
    },
    metadata: {
      name: 'Hook Task',
      description: 'Task Description',
      owner: 'name@example.com',
      source: 'https://tc.example.com/hooks',
    },
    expires: { $fromNow: '3 months' },
    deadline: { $fromNow: '6 hours' },
  },
  triggerSchema: {
    type: 'object',
    properties: {},
    additionalProperties: false,
  },
};

@withStyles(theme => ({
  actionButtonSpan: {
    ...theme.mixins.fab,
    ...theme.mixins.actionButton,
  },
  saveHookSpan: {
    position: 'fixed',
    bottom: theme.spacing.double,
    right: theme.spacing.unit * 11,
  },
  iconButton: {
    '& svg': {
      fill: theme.palette.text.primary,
    },
  },
  listItemButton: {
    ...theme.mixins.listItemButton,
  },
  successIcon: {
    ...theme.mixins.successIcon,
  },
  deleteIcon: {
    ...theme.mixins.errorIcon,
  },
  code: {
    maxHeight: '70vh',
    margin: 0,
  },
  codeEditor: {
    overflow: 'auto',
    maxHeight: '70vh',
  },
  scheduleEntry: {
    paddingTop: 0,
    paddingBottom: 0,
  },
  subheader: {
    fontSize: theme.typography.pxToRem(16),
  },
  errorPanel: {
    maxHeight: '88vh',
    overflow: 'scroll',
    '& span:first-child': {
      overflow: 'unset',
    },
  },
  headline: {
    paddingLeft: theme.spacing.triple,
    paddingRight: theme.spacing.triple,
  },
  metadataContainer: {
    paddingTop: theme.spacing.double,
    paddingBottom: theme.spacing.double,
  },
  drawerPaper: {
    width: '40vw',
    [theme.breakpoints.down('sm')]: {
      width: '90vw',
    },
  },
  hookDescriptionListItem: {
    marginTop: theme.spacing.unit,
    marginBottom: theme.spacing.triple,
  },
  scheduleContainer: {
    paddingRight: theme.spacing.double,
    display: 'flex',
    flex: 1,
    alignItems: 'flex-end',
  },
  scheduleTextField: {
    paddingRight: theme.spacing.double,
  },
  scheduleListItem: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  taskTemplateListItem: {
    marginBottom: theme.spacing.double,
  },
  ownerEmailListItem: {
    display: 'block',
    marginTop: theme.spacing.triple,
  },
  hookGroupAndIdDiv: {
    display: 'flex',
  },
}))
/** A form to view/edit/create a hook */
export default class HookForm extends Component {
  static propTypes = {
    /** Part of a GraphQL hook response containing info about that hook.
     Not needed when creating a new hook */
    hook: hook.isRequired,
    /** Part of the same Grahql hook response as above containing info
     about some last hook fired attempts */
    hookLastFires: array,
    /** Set to `true` when creating a new hook. */
    isNewHook: bool,
    /** Callback function fired when a hook is triggered. */
    onTriggerHook: func,
    /** Callback function fired when a hook is created. */
    onCreateHook: func,
    /** Callback function fired when a hook is updated. */
    onUpdateHook: func,
    /** Callback function fired when a hook is deleted. */
    onDeleteHook: func,
    /** If true, action buttons will be disabled. */
    actionLoading: bool,
    /** Error to display when an action dialog is open. */
    dialogError: oneOfType([string, object]),
    /**
     * Callback function fired when the DialogAction component throws an error.
     * */
    onDialogActionError: func,
    /**
     * Callback function fired when the DialogAction triggers the
     * onComplete handler after successfully deleting a hook.
     * */
    onDialogActionDeleteComplete: func,
  };

  static defaultProps = {
    isNewHook: false,
    hook: initialHook,
    hookLastFires: null,
    onTriggerHook: null,
    onCreateHook: null,
    onUpdateHook: null,
    onDeleteHook: null,
    actionLoading: false,
    dialogError: null,
    onDialogActionError: null,
    onDialogDeleteHook: null,
    deleteDialogOpen: null,
    onDialogActionDeleteComplete: null,
  };

  state = {
    hook: null,
    hookLastFires: null,
    routingKeyPattern: '#',
    pulseExchange: '',
    // eslint-disable-next-line react/no-unused-state
    previousHook: null,
    taskInput: '',
    triggerSchemaInput: '',
    triggerContextInput: '',
    scheduleTextField: '',
    taskValidJson: true,
    triggerSchemaValidJson: true,
    validation: {},
    drawerOpen: false,
    drawerData: null,
  };

  static getDerivedStateFromProps(props, state) {
    if (
      equals(props.hook, state.previousHook) &&
      equals(props.hookLastFires, state.hookLastFires)
    ) {
      return null;
    }

    const hook = props.isNewHook ? initialHook : props.hook;

    return {
      hook: props.hook,
      hookLastFires: props.hookLastFires,
      previousHook: props.hook,
      taskInput: JSON.stringify(
        removeKeys(cloneDeep(hook.task), ['__typename']),
        null,
        2
      ),
      triggerSchemaInput: JSON.stringify(hook.triggerSchema, null, 2),
      triggerContextInput: JSON.stringify({}),
      scheduleTextField: '',
      taskValidJson: true,
      triggerSchemaValidJson: true,
      validation: {
        owner: {
          error: false,
          message: '',
        },
      },
    };
  }

  getHookDefinition = () => {
    const { hook } = this.state;
    const definition = {
      metadata: {
        name: hook.metadata.name,
        description: hook.metadata.description,
        owner: hook.metadata.owner,
        emailOnError: hook.metadata.emailOnError,
      },
      bindings: hook.bindings,
      schedule: hook.schedule,
      task: hook.task,
      triggerSchema: hook.triggerSchema,
    };

    return removeKeys(definition, ['__typename']);
  };

  handleCreateHook = () => {
    const { onCreateHook } = this.props;
    const {
      hook: { hookId, hookGroupId },
    } = this.state;

    onCreateHook &&
      onCreateHook({
        hookId,
        hookGroupId,
        payload: this.getHookDefinition(),
      });
  };

  handleDeleteCronJob = ({ currentTarget: { name } }) => {
    const { hook } = this.state;

    this.setState({
      hook: assocPath(
        ['schedule'],
        hook.schedule.filter(cronJob => cronJob !== name),
        hook
      ),
    });
  };

  handleDeleteHook = () => {
    const { onDeleteHook } = this.props;
    const {
      hook: { hookId, hookGroupId },
    } = this.state;

    if (onDeleteHook) {
      return onDeleteHook({
        hookId,
        hookGroupId,
      });
    }
  };

  handleEmailOnErrorChange = () => {
    this.setState({
      hook: assocPath(
        ['metadata', 'emailOnError'],
        !this.state.hook.metadata.emailOnError,
        this.state.hook
      ),
    });
  };

  handleScheduleChange = ({ target: { name, value } }) => {
    this.setState({ [name]: value });
  };

  handleNewCronJob = () => {
    const { hook, scheduleTextField } = this.state;

    this.setState({
      scheduleTextField: '',
      hook: assocPath(
        ['schedule'],
        this.state.hook.schedule.concat(scheduleTextField),
        hook
      ),
    });
  };

  handleTaskChange = value => {
    const { hook } = this.state;

    try {
      this.setState({
        taskInput: value,
        hook: assocPath(['task'], JSON.parse(value), hook),
        taskValidJson: true,
      });
    } catch (err) {
      this.setState({
        taskInput: value,
        taskValidJson: false,
      });
    }
  };

  handleTriggerContextChange = triggerContextInput => {
    this.setState({ triggerContextInput });
  };

  handleTriggerHookSubmit = () => {
    const { onTriggerHook } = this.props;
    const {
      hook: { hookId, hookGroupId },
      triggerContextInput,
    } = this.state;

    return onTriggerHook({
      hookId,
      hookGroupId,
      payload: JSON.parse(triggerContextInput),
    });
  };

  handleTriggerSchemaChange = value => {
    try {
      this.setState({
        triggerSchemaInput: value,
        hook: assocPath(['triggerSchema'], JSON.parse(value), this.state.hook),
        triggerSchemaValidJson: true,
      });
    } catch (err) {
      this.setState({
        triggerSchemaValidJson: false,
        triggerSchemaInput: value,
      });
    }
  };

  handleUpdateHook = () => {
    const { onUpdateHook } = this.props;
    const {
      hook: { hookId, hookGroupId },
    } = this.state;

    onUpdateHook &&
      onUpdateHook({
        hookId,
        hookGroupId,
        payload: this.getHookDefinition(),
      });
  };

  validHook = () => {
    const {
      hook,
      taskValidJson,
      triggerSchemaValidJson,
      validation,
    } = this.state;

    return (
      hook.hookGroupId &&
      hook.hookId &&
      hook.metadata.name &&
      hook.metadata.owner &&
      hook.bindings &&
      !validation.owner.error &&
      taskValidJson &&
      triggerSchemaValidJson
    );
  };

  handleHookGroupIdChange = e =>
    this.setState({
      hook: assocPath(['hookGroupId'], e.target.value, this.state.hook),
    });

  handleHookIdChange = e =>
    this.setState({
      hook: assocPath(['hookId'], e.target.value, this.state.hook),
    });

  handleNameChange = e =>
    this.setState({
      hook: assocPath(['metadata', 'name'], e.target.value, this.state.hook),
    });

  handleOwnerChange = e => {
    this.setState({
      hook: assocPath(['metadata', 'owner'], e.target.value, this.state.hook),
      validation: {
        owner: {
          error: !e.currentTarget.validity.valid,
          message: e.currentTarget.validationMessage,
        },
      },
    });
  };

  handleDescriptionChange = e =>
    this.setState({
      hook: assocPath(
        ['metadata', 'description'],
        e.target.value,
        this.state.hook
      ),
    });

  handleDrawerClose = () => {
    this.setState({
      drawerOpen: false,
      drawerData: null,
    });
  };

  handleDrawerOpen = ({ currentTarget: { name } }) => {
    const { hookLastFires } = this.state;
    const hookLastFire = hookLastFires.find(({ taskId }) => taskId === name);

    this.setState({
      drawerOpen: true,
      drawerData: hookLastFire,
    });
  };

  handleRoutingKeyPatternChange = ({ target: { value } }) => {
    this.setState({ routingKeyPattern: value });
  };

  handlePulseExchangeChange = ({ target: { name, value } }) => {
    this.setState({ [name]: value });
  };

  handleAddBinding = () => {
    const { pulseExchange, routingKeyPattern } = this.state;
    const bindings = this.state.hook.bindings.concat([
      {
        exchange: pulseExchange,
        routingKeyPattern,
      },
    ]);

    this.setState({
      pulseExchange: '',
      routingKeyPattern: '#',
      hook: {
        ...this.state.hook,
        bindings,
      },
    });
  };

  handleDeleteBinding = ({ exchange, routingKeyPattern }) => {
    const bindings = this.state.hook.bindings.filter(
      binding =>
        binding.exchange !== exchange ||
        binding.routingKeyPattern !== routingKeyPattern
    );

    this.setState({
      hook: {
        ...this.state.hook,
        bindings,
      },
    });
  };

  render() {
    const {
      actionLoading,
      dialogOpen,
      deleteDialogOpen,
      dialogError,
      classes,
      isNewHook,
      onDialogActionClose,
      onDialogActionError,
      onDialogActionDeleteComplete,
      onDialogDeleteHook,
      onDialogOpen,
    } = this.props;
    const {
      routingKeyPattern,
      pulseExchange,
      scheduleTextField,
      taskInput,
      triggerSchemaInput,
      triggerContextInput,
      hook,
      hookLastFires,
      validation,
      drawerOpen,
      drawerData,
    } = this.state;
    const isHookDirty = !equals(hook, this.props.hook);

    return (
      <Fragment>
        <List>
          <div className={classes.hookGroupAndIdDiv}>
            <ListItem>
              <TextField
                required
                label="Hook Group ID"
                name="hookGroupId"
                onChange={this.handleHookGroupIdChange}
                fullWidth
                autoFocus
                disabled={!isNewHook}
                value={hook.hookGroupId}
              />
            </ListItem>
            <ListItem>
              <TextField
                disabled={!isNewHook}
                required
                label="Hook ID"
                name="hookId"
                onChange={this.handleHookIdChange}
                fullWidth
                value={hook.hookId}
              />
            </ListItem>
          </div>
          <ListItem>
            <TextField
              required
              label="Name"
              name="name"
              onChange={this.handleNameChange}
              fullWidth
              value={hook.metadata.name}
            />
          </ListItem>
          <ListItem className={classes.ownerEmailListItem}>
            <TextField
              error={validation.owner.error}
              required
              label="Owner Email"
              name="owner"
              type="email"
              helperText={validation.owner.message}
              onChange={this.handleOwnerChange}
              fullWidth
              value={hook.metadata.owner}
            />
            <FormGroup row>
              <FormControlLabel
                control={
                  <Switch
                    checked={hook.metadata.emailOnError}
                    onChange={this.handleEmailOnErrorChange}
                  />
                }
                label="Email on error"
              />
            </FormGroup>
          </ListItem>
          <ListItem className={classes.hookDescriptionListItem}>
            <MarkdownTextArea
              onChange={this.handleDescriptionChange}
              value={hook.metadata.description}
              placeholder="Hook description (markdown)"
              defaultTabIndex={isNewHook ? 0 : 1}
            />
          </ListItem>
          <ListItem className={classes.scheduleListItem}>
            <div className={classes.scheduleContainer}>
              <TextField
                className={classes.scheduleTextField}
                label="Schedule"
                helperText={
                  <span>
                    See{' '}
                    <a
                      href="https://www.npmjs.com/package/cron-parser"
                      target="_blank"
                      rel="noopener noreferrer">
                      cron-parser
                    </a>{' '}
                    for format information. Times are in UTC.
                  </span>
                }
                name="scheduleTextField"
                placeholder="* * * * * *"
                fullWidth
                onChange={this.handleScheduleChange}
                value={scheduleTextField}
              />
              <IconButton
                className={classes.iconButton}
                onClick={this.handleNewCronJob}>
                <PlusIcon />
              </IconButton>
            </div>
            <List>
              {hook.schedule.map(cronJob => (
                <ListItem className={classes.scheduleEntry} key={cronJob}>
                  <ListItemText primary={<code>{cronJob}</code>} />
                  <IconButton
                    className={classes.iconButton}
                    name={cronJob}
                    onClick={this.handleDeleteCronJob}>
                    <DeleteIcon />
                  </IconButton>
                </ListItem>
              ))}
            </List>
          </ListItem>
          {!isNewHook && (
            <Fragment>
              <ListItem>
                <ListItemText
                  primary="Next Scheduled Fire"
                  secondary={
                    hook.status.nextScheduledDate ? (
                      <DateDistance from={hook.status.nextScheduledDate} />
                    ) : (
                      'n/a'
                    )
                  }
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  disableTypography
                  primary={
                    <Typography variant="subtitle1">
                      Last Fired Attempts
                    </Typography>
                  }
                  secondary={
                    hookLastFires ? (
                      <HookLastFiredTable
                        items={hookLastFires}
                        onErrorClick={this.handleDrawerOpen}
                        paginate
                      />
                    ) : (
                      'n/a'
                    )
                  }
                />
              </ListItem>
            </Fragment>
          )}
          <ListItem>
            <ListItemText
              disableTypography
              primary={<Typography variant="subtitle1">Bindings</Typography>}
              secondary={
                <PulseBindings
                  bindings={hook.bindings}
                  onBindingAdd={this.handleAddBinding}
                  onBindingRemove={this.handleDeleteBinding}
                  onRoutingKeyPatternChange={this.handleRoutingKeyPatternChange}
                  onPulseExchangeChange={this.handlePulseExchangeChange}
                  pulseExchange={pulseExchange}
                  pattern={routingKeyPattern}
                />
              }
            />
          </ListItem>
          <ListItem className={classes.taskTemplateListItem}>
            <ListItemText
              disableTypography
              primary={
                <Typography variant="subtitle1">Task Template *</Typography>
              }
              secondary={
                <Fragment>
                  <Typography
                    gutterBottom
                    color="textSecondary"
                    variant="caption">
                    <span>
                      When the hook fires, this template is rendered with{' '}
                      <a
                        href="https://taskcluster.github.io/json-e/"
                        target="_blank"
                        rel="noopener noreferrer">
                        JSON-e
                      </a>{' '}
                      to create the the task definition. See{' '}
                      {
                        <a
                          target="_blank"
                          rel="noopener noreferrer"
                          href={docs(
                            window.env.TASKCLUSTER_ROOT_URL,
                            'reference/core/hooks/firing-hooks'
                          )}>
                          {'"'}
                          firing hooks
                          {'"'}
                        </a>
                      }{' '}
                      for more information.
                    </span>
                  </Typography>
                  <CodeEditor
                    lint
                    value={taskInput}
                    onChange={this.handleTaskChange}
                  />
                </Fragment>
              }
            />
          </ListItem>
          <ListItem>
            <ListItemText
              disableTypography
              primary={
                <Typography variant="subtitle1">Trigger Schema *</Typography>
              }
              secondary={
                <Fragment>
                  <Typography
                    gutterBottom
                    color="textSecondary"
                    variant="caption">
                    The payload to <code>triggerHook</code> must match this
                    schema.
                  </Typography>
                  <CodeEditor
                    lint
                    value={triggerSchemaInput}
                    onChange={this.handleTriggerSchemaChange}
                  />
                </Fragment>
              }
            />
          </ListItem>
        </List>
        {isNewHook ? (
          <Button
            spanProps={{ className: classes.actionButtonSpan }}
            tooltipProps={{ title: 'Save Hook' }}
            requiresAuth
            classes={{ root: classes.successIcon }}
            variant="round"
            disabled={!this.validHook() || actionLoading || !isHookDirty}
            onClick={this.handleCreateHook}>
            <ContentSaveIcon />
          </Button>
        ) : (
          <Fragment>
            <Button
              spanProps={{
                className: classNames(
                  classes.actionButtonSpan,
                  classes.saveHookSpan
                ),
              }}
              tooltipProps={{ title: 'Save Hook' }}
              requiresAuth
              classes={{ root: classes.successIcon }}
              variant="round"
              disabled={!this.validHook() || actionLoading || !isHookDirty}
              onClick={this.handleUpdateHook}>
              <ContentSaveIcon />
            </Button>
            <SpeedDial>
              <SpeedDialAction
                requiresAuth
                tooltipOpen
                icon={<DeleteIcon />}
                onClick={onDialogDeleteHook}
                className={classes.deleteIcon}
                ButtonProps={{
                  disabled: actionLoading,
                }}
                tooltipTitle="Delete Hook"
              />
              <SpeedDialAction
                requiresAuth
                tooltipOpen
                icon={<FlashIcon />}
                onClick={onDialogOpen}
                className={classes.successIcon}
                ButtonProps={{
                  disabled: !this.validHook() || actionLoading,
                }}
                tooltipTitle="Trigger Hook"
              />
            </SpeedDial>
          </Fragment>
        )}
        {dialogOpen && (
          <DialogAction
            fullScreen
            open={dialogOpen}
            onSubmit={this.handleTriggerHookSubmit}
            onComplete={onDialogActionClose}
            onClose={onDialogActionClose}
            onError={onDialogActionError}
            error={dialogError}
            confirmText="Trigger Hook"
            body={
              <Fragment>
                <Typography gutterBottom>
                  Trigger Hook{' '}
                  <code>
                    {hook.hookGroupId}/{hook.hookId}
                  </code>{' '}
                  with the following context:
                </Typography>
                <Grid container spacing={16}>
                  <Grid item lg={6} md={6} sm={12}>
                    <Typography gutterBottom variant="subtitle1">
                      Context
                    </Typography>
                    <CodeEditor
                      lint
                      className={classes.codeEditor}
                      value={triggerContextInput}
                      onChange={this.handleTriggerContextChange}
                    />
                  </Grid>
                  <Grid item lg={6} md={6} sm={12}>
                    <Typography gutterBottom variant="subtitle1">
                      Schema
                    </Typography>
                    <Code language="json" className={classes.code}>
                      {JSON.stringify(hook.triggerSchema, null, 2)}
                    </Code>
                  </Grid>
                </Grid>
              </Fragment>
            }
          />
        )}
        {deleteDialogOpen && (
          <DialogAction
            open={deleteDialogOpen}
            title="Delete?"
            onSubmit={this.handleDeleteHook}
            onComplete={onDialogActionDeleteComplete}
            onClose={onDialogActionClose}
            onError={onDialogActionError}
            error={dialogError}
            confirmText="Delete Hook"
            body={
              <Typography>
                This will delete {hook.hookGroupId}/{hook.hookId}
              </Typography>
            }
          />
        )}
        <Drawer
          anchor="right"
          open={drawerOpen}
          classes={{
            paper: classes.drawerPaper,
          }}
          onClose={this.handleDrawerClose}>
          <div className={classes.metadataContainer}>
            <Typography variant="h6" className={classes.headline}>
              {drawerData && drawerData.taskId}
            </Typography>
            <List>
              <ListItem>
                <ListItemText
                  primary={
                    drawerData &&
                    drawerData.error && (
                      <ErrorPanel
                        className={classes.errorPanel}
                        error={drawerData && drawerData.error}
                        onClose={null}
                      />
                    )
                  }
                />
              </ListItem>
            </List>
          </div>
        </Drawer>
      </Fragment>
    );
  }
}
