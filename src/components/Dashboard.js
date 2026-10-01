import React, { Component } from 'react';
import "./style.css";
import IngredientInput from './IngredientInput';
import Notifications from './Notifications';
import NotificationWrapper from './NotificationWrapper';
import { GlobalContext } from '../context/GlobalState';

class Dashboard extends Component {
    static contextType = GlobalContext;

    state = { user_name: undefined, ingredients: undefined, login: false };

    componentDidMount() {
        this.setState({ login: true, user_name: 'Local User', ingredients: this.context.ingredients });
    }

    updateIngredients = () => {
        this.setState({ ingredients: this.context.ingredients });
    }

    removeIngredients = (id) => {
        this.context.deleteIngredient(id);
        this.updateIngredients();
    }

    // onClickAlert = () => {
    //     this.alert();
    // }

    render() {
        return (
            <div className="fade-in">
                <h1>Welcome {this.state.user_name}</h1>
                <div className="container container-inner-color">
                    <div className="row">
                        <div className="col-md-6">
                            {/* <div className="container"> */}
                                <h2>Input your ingredients</h2>
                                <IngredientInput afterSubmit={this.updateIngredients} addIngredient={this.context.addIngredient}></IngredientInput>  
                            {/* </div> */}
                        </div>
                        <div className="col-md-6">
                            {/* <div className="container"> */}
                                <h2>Notifications</h2>
                                <NotificationWrapper>
                                    <Notifications ingredients={this.state.ingredients}></Notifications>
                                </NotificationWrapper>
                            {/* </div> */}
                        </div>
                    </div>
                </div>
                
                
                    
                {/* <div className="container border rounded"> */}


                
            </div>
        );
    }

}


export default Dashboard;